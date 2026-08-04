export default function LoadingScreen() {
  return (
    <div className="sle-loader" role="status" aria-label="Loading news briefing">
      <div className="sle-loader-inner">
        <span className="sle-loader-kicker">Your entrepreneur briefing</span>
        <img
          src="/logo.svg"
          alt="Sri Lankan Entrepreneur"
          className="sle-loader-logo"
        />

        <div className="sle-loader-bar-wrap" aria-hidden="true">
          <div className="sle-loader-bar"></div>
        </div>

        <div className="sle-loader-text">Curating today’s essential stories</div>
      </div>
    </div>
  );
}
