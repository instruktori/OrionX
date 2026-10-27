import { Command, Fingerprint, GraduationCap } from "lucide-react";
export function PassportIdentity({
  name,
  program,
  id,
  issued = false,
}: {
  name?: string;
  program?: string;
  id?: string | null;
  issued?: boolean;
}) {
  return (
    <div className="passport-identity">
      <div className="passport-identity-top">
        <span>
          <Command size={19} />
          ORIONX
        </span>
        <span className="mono">
          {issued ? "DIGITAL PASSPORT" : "PASSPORT PREVIEW"}
        </span>
      </div>
      <div className="passport-insignia">
        <Fingerprint size={54} strokeWidth={1} />
      </div>
      <div className="passport-identity-name">
        <span className="mini-kicker">AI SKILLS · PERMANENT RECORD</span>
        <h2>
          {name || (
            <>
              Your potential.
              <br />
              On the record.
            </>
          )}
        </h2>
        <p>{program || "A passport that grows with every achievement."}</p>
      </div>
      <div className="passport-identity-footer">
        <div>
          <small>
            {issued
              ? "PASSPORT IDENTIFIER"
              : "BUILT FOR UNIVERSITY RECOGNITION"}
          </small>
          <span className="mono">
            {id || "One identity. Every achievement."}
          </span>
        </div>
        <GraduationCap size={26} strokeWidth={1.3} />
      </div>
    </div>
  );
}
