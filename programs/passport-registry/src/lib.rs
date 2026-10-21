use anchor_lang::prelude::*;

// Replace with the actual deployed Devnet program ID before deployment.
// Anchor requires a compile-time declared ID; this placeholder is NOT a deployed program.
declare_id!("11111111111111111111111111111111");

#[program]
pub mod passport_registry {
    use super::*;

    pub fn initialize_issuer(ctx: Context<InitializeIssuer>, issuer: Pubkey) -> Result<()> {
        require_keys_eq!(ctx.accounts.admin.key(), crate::BOOTSTRAP_ADMIN, RegistryError::Unauthorized);
        require!(issuer != Pubkey::default(), RegistryError::InvalidIssuer);
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.issuer = issuer;
        config.epoch = 1;
        config.paused = false;
        config.bump = ctx.bumps.config;
        let epoch = &mut ctx.accounts.epoch;
        epoch.number = 1;
        epoch.issuer = issuer;
        epoch.bump = ctx.bumps.epoch;
        Ok(())
    }

    pub fn create_passport(ctx: Context<CreatePassport>, opaque_reference: [u8; 32], code: [u8; 20], hash: [u8; 32]) -> Result<()> {
        let config = &ctx.accounts.config;
        require!(!config.paused, RegistryError::Paused);
        require_keys_eq!(ctx.accounts.issuer.key(), config.issuer, RegistryError::Unauthorized);
        require!(opaque_reference != [0u8;32], RegistryError::InvalidReference);
        require!(hash != [0u8;32], RegistryError::InvalidHash);
        let registry = &mut ctx.accounts.registry;
        registry.reference = opaque_reference;
        registry.latest_version = 1;
        registry.latest_record = ctx.accounts.record.key();
        registry.bump = ctx.bumps.registry;
        let record = &mut ctx.accounts.record;
        record.reference = opaque_reference;
        record.version = 1;
        record.code = code;
        record.pdf_sha256 = hash;
        record.issuer_epoch = config.epoch;
        record.previous = Pubkey::default();
        record.bump = ctx.bumps.record;
        Ok(())
    }

    pub fn register_next_version(ctx: Context<RegisterNextVersion>, code: [u8; 20], hash: [u8; 32]) -> Result<()> {
        let config = &ctx.accounts.config;
        require!(!config.paused, RegistryError::Paused);
        require_keys_eq!(ctx.accounts.issuer.key(), config.issuer, RegistryError::Unauthorized);
        require!(hash != [0u8;32], RegistryError::InvalidHash);
        let registry = &mut ctx.accounts.registry;
        require!(registry.latest_version < u32::MAX, RegistryError::Overflow);
        let record = &mut ctx.accounts.record;
        record.reference = registry.reference;
        record.version = registry.latest_version.checked_add(1).ok_or(RegistryError::Overflow)?;
        record.code = code;
        record.pdf_sha256 = hash;
        record.issuer_epoch = config.epoch;
        record.previous = registry.latest_record;
        record.bump = ctx.bumps.record;
        registry.latest_version = record.version;
        registry.latest_record = record.key();
        Ok(())
    }

    pub fn rotate_issuer(ctx: Context<RotateIssuer>, next_issuer: Pubkey) -> Result<()> {
        require!(next_issuer != Pubkey::default(), RegistryError::InvalidIssuer);
        let config = &mut ctx.accounts.config;
        let next = config.epoch.checked_add(1).ok_or(RegistryError::Overflow)?;
        config.issuer = next_issuer;
        config.epoch = next;
        let epoch = &mut ctx.accounts.next_epoch;
        epoch.number = next;
        epoch.issuer = next_issuer;
        epoch.bump = ctx.bumps.next_epoch;
        Ok(())
    }

    pub fn set_paused(ctx: Context<AdminOnly>, paused: bool) -> Result<()> {
        ctx.accounts.config.paused = paused;
        Ok(())
    }
}

// Replace the compile-time bootstrap admin with an explicitly approved public key.
// Never use a first-caller-wins initialization scheme.
pub const BOOTSTRAP_ADMIN: Pubkey = Pubkey::new_from_array([0u8;32]);

#[derive(Accounts)]
#[instruction(issuer: Pubkey)]
pub struct InitializeIssuer<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer=admin, space=8+IssuerConfig::INIT_SPACE, seeds=[b"issuer-config"], bump)]
    pub config: Account<'info, IssuerConfig>,
    #[account(init, payer=admin, space=8+IssuerEpoch::INIT_SPACE, seeds=[b"issuer-epoch", &1u32.to_le_bytes()], bump)]
    pub epoch: Account<'info, IssuerEpoch>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
#[instruction(opaque_reference: [u8;32], code: [u8;20], hash: [u8;32])]
pub struct CreatePassport<'info> {
    #[account(mut)]
    pub issuer: Signer<'info>,
    #[account(seeds=[b"issuer-config"], bump=config.bump)]
    pub config: Account<'info, IssuerConfig>,
    #[account(init, payer=issuer, space=8+PassportRegistry::INIT_SPACE, seeds=[b"passport", opaque_reference.as_ref()], bump)]
    pub registry: Account<'info, PassportRegistry>,
    #[account(init, payer=issuer, space=8+VersionRecord::INIT_SPACE, seeds=[b"version", code.as_ref()], bump)]
    pub record: Account<'info, VersionRecord>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
#[instruction(code: [u8;20], hash: [u8;32])]
pub struct RegisterNextVersion<'info> {
    #[account(mut)]
    pub issuer: Signer<'info>,
    #[account(seeds=[b"issuer-config"], bump=config.bump)]
    pub config: Account<'info, IssuerConfig>,
    #[account(mut, seeds=[b"passport", registry.reference.as_ref()], bump=registry.bump)]
    pub registry: Account<'info, PassportRegistry>,
    #[account(init, payer=issuer, space=8+VersionRecord::INIT_SPACE, seeds=[b"version", code.as_ref()], bump)]
    pub record: Account<'info, VersionRecord>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct RotateIssuer<'info> {
    #[account(mut, address=config.admin @ RegistryError::Unauthorized)]
    pub admin: Signer<'info>,
    #[account(mut, seeds=[b"issuer-config"], bump=config.bump)]
    pub config: Account<'info, IssuerConfig>,
    #[account(init, payer=admin, space=8+IssuerEpoch::INIT_SPACE, seeds=[b"issuer-epoch", &(config.epoch+1).to_le_bytes()], bump)]
    pub next_epoch: Account<'info, IssuerEpoch>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct AdminOnly<'info> {
    #[account(address=config.admin @ RegistryError::Unauthorized)]
    pub admin: Signer<'info>,
    #[account(mut, seeds=[b"issuer-config"], bump=config.bump)]
    pub config: Account<'info, IssuerConfig>,
}
#[account]
#[derive(InitSpace)]
pub struct IssuerConfig {
    pub admin: Pubkey,
    pub issuer: Pubkey,
    pub epoch: u32,
    pub paused: bool,
    pub bump: u8,
}
#[account]
#[derive(InitSpace)]
pub struct IssuerEpoch {
    pub number: u32,
    pub issuer: Pubkey,
    pub bump: u8,
}
#[account]
#[derive(InitSpace)]
pub struct PassportRegistry {
    pub reference: [u8;32],
    pub latest_version: u32,
    pub latest_record: Pubkey,
    pub bump: u8,
}
#[account]
#[derive(InitSpace)]
pub struct VersionRecord {
    pub reference: [u8;32],
    pub version: u32,
    pub code: [u8;20],
    pub pdf_sha256: [u8;32],
    pub issuer_epoch: u32,
    pub previous: Pubkey,
    pub bump: u8,
}
#[error_code]
pub enum RegistryError {
    #[msg("Signer is not authorized")] Unauthorized,
    #[msg("Issuance is paused")] Paused,
    #[msg("Invalid issuer")] InvalidIssuer,
    #[msg("Invalid opaque reference")] InvalidReference,
    #[msg("Invalid hash")] InvalidHash,
    #[msg("Version counter overflow")] Overflow,
}
