import { useNavigate } from "react-router";
import kej from "../components/src/kej.png";
import  "../components/App.css"
export default function HomePage() {
  const navigate = useNavigate();
  return (
    <div className = "index-page">
      {/* SKEJ Title */}
      <h1
        style={{
          fontFamily: "Agrandir, sans-serif",
          fontSize: "4rem",
          color: "#00a6a6",
          marginBottom: "20px",
        }}
      >
        Skej
      </h1>

      {/* Subtitle */}
      <p
        style={{
          fontFamily: "Agrandir, sans-serif",
          fontSize: "1.5rem",
          color: "#fff1b7",
          textAlign: "center",
          marginBottom: "40px",
        }}
      >
        University is a jungle. Let us help you navigate it.
      </p>

      {/* Button */}
      <button
        style={{
          backgroundColor: "#00a6a6",
          color: "#fff1b7",
          padding: "10px 20px",
          borderRadius: "100px",
          border: "8px solid #00cdcd ",
          cursor: "pointer",
          marginTop: "20px",
          opacity: "90%",
        }}
        onClick={() => navigate("/form")}
      >
        Check out the map {'->'}
      </button>

      {/* Footer */}
      <footer
        style={{
          width: "100vw",
          padding: "20px",
          marginTop: "40px", // Adds space between content and footer
        }}
      >
        <img
          src={kej}
          alt="Footer Image"
          style={{
            width: "100%",  // Adjust size as needed
            height: "100%",  // Keeps the aspect ratio
          }}
        />
      </footer>
    </div>
  );
}
