document
  .getElementById("loginForm")
  .addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("https://locals-v5-api.onrender.com/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error("Login failed");
      }

      const data = await response.json();
      localStorage.setItem("accessToken", data.accessToken);

      // Redirect to the main page
      window.location.href = data.redirectUrl;
    } catch (error) {
      console.error("Error during login:", error);
    }
  });

async function likeLocation(locationId) {
  const token = localStorage.getItem("accessToken");
  if (!token) {
    console.error("No token found, please login first.");
    return;
  }

  try {
    const response = await fetch(
      `https://locals-v5-api.onrender.com/locations/${locationId}/like`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const updatedLocation = await response.json();
    console.log("Location liked:", updatedLocation);
    initializeApp(); // Refresh locations
  } catch (error) {
    console.error("Failed to like location:", error);
  }
}
