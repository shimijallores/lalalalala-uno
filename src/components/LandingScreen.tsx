import { ArrowRight, Link2, Plus } from "lucide-react";
import { motion } from "motion/react";
import { LANDING_BANNER_ASSET } from "../game/assets";

interface LandingScreenProps {
  displayName: string;
  roomCode: string;
  configured: boolean;
  error: string | null;
  pending: string | null;
  onDisplayNameChange: (value: string) => void;
  onRoomCodeChange: (value: string) => void;
  onCreate: () => void;
  onJoin: () => void;
}

export function LandingScreen({
  displayName,
  roomCode,
  configured,
  error,
  pending,
  onDisplayNameChange,
  onRoomCodeChange,
  onCreate,
  onJoin,
}: LandingScreenProps) {
  const disabled = !configured || Boolean(pending);
  return (
    <main id="main-content" className="landing-screen">
      <section className="landing-copy" aria-labelledby="landing-title">
        <div className="landing-art" aria-hidden="true">
          <div className="landing-banner-wrap">
            <img
              className="landing-banner"
              src={LANDING_BANNER_ASSET}
              alt="UNO card artwork"
            />
          </div>
          <div className="landing-art-stamp">
            PLAY
            <br />
            LOUD
          </div>
        </div>

        <h1 className="landing-title" id="landing-title">
          UNO <span>DUEL</span>
        </h1>
        <p className="landing-description">
          A two-player showdown, turning friends to rivals.
        </p>
      </section>

      <motion.section
        className="entry-panel"
        aria-labelledby="entry-title"
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="entry-panel-heading">
          <div>
            <h2 id="entry-title">Pull up a chair</h2>
            <p>Your display name follows you between rooms.</p>
          </div>
        </div>

        <div className="form-stack">
          <div className="form-field">
            <label htmlFor="display-name">Display name</label>
            <input
              id="display-name"
              value={displayName}
              onChange={(event) => onDisplayNameChange(event.target.value)}
              maxLength={20}
              placeholder="e.g. Zi"
              autoComplete="nickname"
            />
            <span className="field-hint">
              Use a name your friend will recognize.
            </span>
          </div>
          <div className="form-field">
            <label htmlFor="room-code">Room code</label>
            <input
              id="room-code"
              className="code-input"
              value={roomCode}
              onChange={(event) =>
                onRoomCodeChange(
                  event.target.value
                    .toUpperCase()
                    .replace(/[^A-Z2-9]/g, "")
                    .slice(0, 8),
                )
              }
              maxLength={8}
              placeholder="ABCDEF"
              autoComplete="off"
            />
            <span className="field-hint">
              Joining a friend? Paste their 6–8 character code.
            </span>
          </div>
        </div>

        <div className="entry-actions">
          <button
            type="button"
            className="button button-primary"
            disabled={disabled || !displayName.trim()}
            onClick={onCreate}
          >
            <Plus size={17} aria-hidden="true" /> Create room
          </button>
          <button
            type="button"
            className="button button-secondary"
            disabled={disabled || !displayName.trim() || roomCode.length < 6}
            onClick={onJoin}
          >
            <Link2 size={17} aria-hidden="true" /> Join room{" "}
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>

        {error && (
          <div className="inline-message error" role="alert">
            {error}
          </div>
        )}
        {!configured && (
          <div className="inline-message" role="status">
            Add the two Vite Supabase variables from <code>.env.example</code>{" "}
            to enable private rooms. This client will not fall back to local
            multiplayer.
          </div>
        )}

        <details className="how-to-play">
          <summary>How to play</summary>
          <ul>
            <li>
              Start with seven cards. Match the discard by color, number, or
              action.
            </li>
            <li>
              Wild cards change the color. Wild Draw Four is only legal when you
              have no matching color.
            </li>
            <li>When you reach one card, call UNO before your next move.</li>
          </ul>
        </details>
      </motion.section>
    </main>
  );
}
