export default function LoadingScreen() {
  return (
    <div className="sle-loader">
      <img
        src="/logo.svg"
        alt="Sri Lankan Entrepreneur"
        className="sle-loader-logo"
      />

      <div className="sle-loader-bar-wrap">
        <div className="sle-loader-bar"></div>
      </div>

      <div className="sle-loader-text">Loading latest updates</div>
    </div>
  );
}