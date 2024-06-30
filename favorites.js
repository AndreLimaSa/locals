async function fetchFavoriteLocations() {
  try {
    const response = await fetch("/favorites", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const favoriteLocations = await response.json();
    console.log("Fetched favorite locations:", favoriteLocations); // Log fetched locations
    renderFavoriteLocations(favoriteLocations);
  } catch (error) {
    console.error("Error fetching favorite locations:", error);
  }
}

function renderFavoriteLocations(locations) {
  const favoriteLocationsDiv = document.getElementById("favorite-locations");
  favoriteLocationsDiv.innerHTML = "";

  if (locations.length === 0) {
    favoriteLocationsDiv.innerHTML = "<p>No favorite locations found.</p>";
    return;
  }

  locations.forEach((location) => {
    const locationDiv = document.createElement("div");
    locationDiv.className = "location";
    locationDiv.setAttribute("data-id", location._id);

    locationDiv.innerHTML = `
      <img src="${location.src}" alt="${location.title}">
      <h3>${location.title}</h3>
      <p>${location.description}</p>
      
    `;

    favoriteLocationsDiv.appendChild(locationDiv);
  });
}

// Fetch and render favorite locations on page load
fetchFavoriteLocations();
