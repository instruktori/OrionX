use anchor_lang::prelude::*;
declare_id!("9q3EFytGCsR2hk5FnerXxMWomC2yCajpx78durY91JPa");
pub const BOOTSTRAP_ADMIN: Pubkey = pubkey!("BNcEvP3benzCX7tc1W2U6upZ5HVT4hzneZahVKMpCPiv");
pub const SCHEMA: u8 = 1;

#[program]
pub mod passport_registry {
    use super::*;
    pub fn initialize_issuer(ctx: Context<InitializeIssuer>, issuer: Pubkey, attestation: [u8; 32]) -> Result<()> {
        require_keys_eq!(ctx.accounts.admin.key(), BOOTSTRAP_ADMIN, RegistryError::Unauthorized);
        require!(issuer != Pubkey::default(), RegistryError::InvalidIssuer);
        let c = &mut ctx.accounts.config;
        c.schema = SCHEMA; c.admin = ctx.accounts.admin.key(); c.current_authority = issuer;
        c.current_epoch = 1; c.paused = false; c.bump = ctx.bumps.config;
        let clock = Clock::get()?;
        let e = &mut ctx.accounts.epoch;
        e.schema = SCHEMA; e.config = c.key(); e.epoch = 1; e.authority = issuer;
        e.activated_slot = clock.slot; e.activated_unix = clock.unix_timestamp;
        e.attestation_digest = attestation; e.bump = ctx.bumps.epoch;
        emit!(IssuerInitialized { config: c.key(), issuer, epoch: 1 });
        Ok(())
    }
    pub fn create_passport(ctx: Context<CreatePassport>, opaque_ref: [u8; 32]) -> Result<()> {
        require!(!ctx.accounts.config.paused, RegistryError::Paused);
        require!(opaque_ref != [0; 32], RegistryError::InvalidReference);
        let r = &mut ctx.accounts.registry;
        r.schema = SCHEMA; r.config = ctx.accounts.config.key(); r.opaque_ref = opaque_ref;
        r.latest_version = 0; r.latest_record = Pubkey::default(); r.bump = ctx.bumps.registry;
        emit!(PassportCreated { registry: r.key() });
        Ok(())
    }
    pub fn register_next_version(ctx: Context<RegisterNextVersion>, expected_version: u32, code: [u8; 20], hash: [u8; 32], expected_previous: Pubkey) -> Result<()> {
        let c = &ctx.accounts.config;
        require!(!c.paused, RegistryError::Paused);
        require!(code != [0; 20] && hash != [0; 32], RegistryError::InvalidHash);
        let r = &mut ctx.accounts.registry;
        require!(r.latest_version.checked_add(1) == Some(expected_version), RegistryError::InvalidVersion);
        require_keys_eq!(r.latest_record, expected_previous, RegistryError::InvalidPrevious);
        let clock = Clock::get()?;
        let v = &mut ctx.accounts.record;
        v.schema = SCHEMA; v.registry = r.key(); v.version = expected_version; v.code = code;
        v.pdf_sha256 = hash; v.issuer = ctx.accounts.issuer.key(); v.issuer_epoch = c.current_epoch;
        v.previous_record = expected_previous; v.registered_unix = clock.unix_timestamp;
        v.registered_slot = clock.slot; v.bump = ctx.bumps.record;
        r.latest_version = expected_version; r.latest_record = v.key();
        emit!(VersionRegistered { registry: r.key(), record: v.key(), version: expected_version, code, hash, issuer: v.issuer, epoch: v.issuer_epoch, slot: clock.slot });
        Ok(())
    }
    pub fn rotate_issuer(ctx: Context<RotateIssuer>, attestation: [u8; 32]) -> Result<()> {
        let c = &mut ctx.accounts.config;
        let number = c.current_epoch.checked_add(1).ok_or(RegistryError::Overflow)?;
        let authority = ctx.accounts.new_authority.key();
        require!(authority != Pubkey::default(), RegistryError::InvalidIssuer);
        let clock = Clock::get()?;
        let e = &mut ctx.accounts.next_epoch;
        e.schema = SCHEMA; e.config = c.key(); e.epoch = number; e.authority = authority;
        e.activated_slot = clock.slot; e.activated_unix = clock.unix_timestamp;
        e.attestation_digest = attestation; e.bump = ctx.bumps.next_epoch;
        c.current_authority = authority; c.current_epoch = number;
        emit!(IssuerRotated { config: c.key(), issuer: authority, epoch: number });
        Ok(())
    }
    pub fn set_paused(ctx: Context<AdminOnly>, paused: bool) -> Result<()> {
        ctx.accounts.config.paused = paused;
        emit!(IssuancePaused { config: ctx.accounts.config.key(), paused });
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeIssuer<'info> {
    #[account(mut, address = BOOTSTRAP_ADMIN @ RegistryError::Unauthorized)] pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + IssuerConfig::INIT_SPACE, seeds = [b"issuer"], bump)] pub config: Account<'info, IssuerConfig>,
    #[account(init, payer = admin, space = 8 + IssuerEpoch::INIT_SPACE, seeds = [b"issuer_epoch", config.key().as_ref(), &1u32.to_le_bytes()], bump)] pub epoch: Account<'info, IssuerEpoch>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
#[instruction(opaque_ref: [u8; 32])]
pub struct CreatePassport<'info> {
    #[account(mut, address = config.current_authority @ RegistryError::Unauthorized)] pub issuer: Signer<'info>,
    #[account(seeds = [b"issuer"], bump = config.bump, constraint = config.schema == SCHEMA @ RegistryError::InvalidSchema)] pub config: Account<'info, IssuerConfig>,
    #[account(init, payer = issuer, space = 8 + PassportRegistry::INIT_SPACE, seeds = [b"passport", config.key().as_ref(), &opaque_ref], bump)] pub registry: Account<'info, PassportRegistry>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
#[instruction(expected_version: u32, code: [u8; 20])]
pub struct RegisterNextVersion<'info> {
    #[account(mut, address = config.current_authority @ RegistryError::Unauthorized)] pub issuer: Signer<'info>,
    #[account(seeds = [b"issuer"], bump = config.bump, constraint = config.schema == SCHEMA @ RegistryError::InvalidSchema)] pub config: Account<'info, IssuerConfig>,
    #[account(seeds = [b"issuer_epoch", config.key().as_ref(), &config.current_epoch.to_le_bytes()], bump = epoch.bump, constraint = epoch.config == config.key(), constraint = epoch.authority == issuer.key(), constraint = epoch.epoch == config.current_epoch)] pub epoch: Account<'info, IssuerEpoch>,
    #[account(mut, seeds = [b"passport", config.key().as_ref(), &registry.opaque_ref], bump = registry.bump, constraint = registry.config == config.key(), constraint = registry.schema == SCHEMA @ RegistryError::InvalidSchema)] pub registry: Account<'info, PassportRegistry>,
    #[account(init, payer = issuer, space = 8 + VersionRecord::INIT_SPACE, seeds = [b"version", code.as_ref()], bump)] pub record: Account<'info, VersionRecord>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct RotateIssuer<'info> {
    #[account(mut, address = config.admin @ RegistryError::Unauthorized)] pub admin: Signer<'info>,
    pub new_authority: Signer<'info>,
    #[account(mut, seeds = [b"issuer"], bump = config.bump)] pub config: Account<'info, IssuerConfig>,
    #[account(init, payer = admin, space = 8 + IssuerEpoch::INIT_SPACE, seeds = [b"issuer_epoch", config.key().as_ref(), &(config.current_epoch.checked_add(1).ok_or(RegistryError::Overflow)?).to_le_bytes()], bump)] pub next_epoch: Account<'info, IssuerEpoch>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct AdminOnly<'info> {
    #[account(address = config.admin @ RegistryError::Unauthorized)] pub admin: Signer<'info>,
    #[account(mut, seeds = [b"issuer"], bump = config.bump)] pub config: Account<'info, IssuerConfig>,
}
#[account]
#[derive(InitSpace)]
pub struct IssuerConfig { pub schema: u8, pub admin: Pubkey, pub current_authority: Pubkey, pub current_epoch: u32, pub paused: bool, pub bump: u8 }
#[account]
#[derive(InitSpace)]
pub struct IssuerEpoch { pub schema: u8, pub config: Pubkey, pub epoch: u32, pub authority: Pubkey, pub activated_slot: u64, pub activated_unix: i64, pub attestation_digest: [u8;32], pub bump: u8 }
#[account]
#[derive(InitSpace)]
pub struct PassportRegistry { pub schema: u8, pub config: Pubkey, pub opaque_ref: [u8;32], pub latest_version: u32, pub latest_record: Pubkey, pub bump: u8 }
#[account]
#[derive(InitSpace)]
pub struct VersionRecord { pub schema: u8, pub registry: Pubkey, pub version: u32, pub code: [u8;20], pub pdf_sha256: [u8;32], pub issuer: Pubkey, pub issuer_epoch: u32, pub previous_record: Pubkey, pub registered_unix: i64, pub registered_slot: u64, pub bump: u8 }
#[event] pub struct IssuerInitialized { pub config: Pubkey, pub issuer: Pubkey, pub epoch: u32 }
#[event] pub struct IssuerRotated { pub config: Pubkey, pub issuer: Pubkey, pub epoch: u32 }
#[event] pub struct IssuancePaused { pub config: Pubkey, pub paused: bool }
#[event] pub struct PassportCreated { pub registry: Pubkey }
#[event] pub struct VersionRegistered { pub registry: Pubkey, pub record: Pubkey, pub version: u32, pub code: [u8;20], pub hash: [u8;32], pub issuer: Pubkey, pub epoch: u32, pub slot: u64 }
#[error_code]
pub enum RegistryError {
    #[msg("Signer is not authorized")] Unauthorized,
    #[msg("Issuance is paused")] Paused,
    #[msg("Invalid issuer")] InvalidIssuer,
    #[msg("Invalid passport reference")] InvalidReference,
    #[msg("Zero code or hash")] InvalidHash,
    #[msg("Unexpected next version")] InvalidVersion,
    #[msg("Unexpected previous record")] InvalidPrevious,
    #[msg("Unsupported account schema")] InvalidSchema,
    #[msg("Version or epoch overflow")] Overflow,
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn protocol_account_sizes_match_specification() {
        assert_eq!(8 + IssuerConfig::INIT_SPACE, 79);
        assert_eq!(8 + IssuerEpoch::INIT_SPACE, 126);
        assert_eq!(8 + PassportRegistry::INIT_SPACE, 110);
        assert_eq!(8 + VersionRecord::INIT_SPACE, 182);
    }
    #[test] fn version_bytes_round_trip_with_discriminator() {
        let v = VersionRecord {schema: SCHEMA, registry: Pubkey::new_unique(), version: 1, code: [7;20], pdf_sha256: [9;32], issuer: Pubkey::new_unique(), issuer_epoch: 1, previous_record: Pubkey::default(), registered_unix: 1000, registered_slot: 50, bump: 255};
        let mut bytes = Vec::new(); v.try_serialize(&mut bytes).unwrap();
        assert_eq!(bytes.len(),182);
        let restored = VersionRecord::try_deserialize(&mut bytes.as_slice()).unwrap();
        assert_eq!(restored.code, v.code); assert_eq!(restored.registered_slot,50);
    }
}
