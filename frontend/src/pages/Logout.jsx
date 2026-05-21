import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

function Logout() {
  const navigate = useNavigate();

  useEffect(() => {
    // ✅ Burahin lahat ng tokens / user info
    localStorage.removeItem("token");      // kung JWT ang gamit
    localStorage.removeItem("is_staff");   // kung may role flag ka
    localStorage.removeItem("refresh");    // optional kung may refresh token

    sessionStorage.clear();                // clear din kung may laman

    // ✅ Redirect to login page
    navigate("/login", { replace: true });
  }, [navigate]);

  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h2>Logging out…</h2>
      <p>Please wait while we redirect you to the login page.</p>
    </div>
  );
}

export default Logout;
