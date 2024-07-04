async function fetchLocations() {
  const apiUrl = "https://locals-v5-api.onrender.com/locations"; // Update with your actual deployed server URL
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const locations = await response.json();
    return locations;
  } catch (error) {
    console.error("Failed to fetch locations:", error);
    return [];
  }
}
let map;
let markerClusterGroup;

// Initialize the map
function initializeMap() {
  map = L.map("map").setView([0, 0], 2); // Adjust initial view and zoom level as needed

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
  }).addTo(map);

  markerClusterGroup = L.markerClusterGroup({
    maxClusterRadius: 25, // Adjust this value to control the clustering radius
    disableClusteringAtZoom: 15, // Set this to the zoom level where you want clustering to stop
  });
  map.addLayer(markerClusterGroup);
  // Function to handle successful geolocation
  function onLocationFound(e) {
    const radius = e.accuracy / 2;

    L.marker(e.latlng)
      .addTo(map)
      .bindPopup(`You are within ${radius} meters from this point`)
      .openPopup();

    L.circle(e.latlng, radius).addTo(map);

    map.setView(e.latlng, 13); // Adjust the map view to the user's location
  }

  // Function to handle geolocation error
  function onLocationError(e) {
    alert(e.message);
  }

  map.on("locationfound", onLocationFound);
  map.on("locationerror", onLocationError);

  // Request the user's location
  map.locate({ setView: true, maxZoom: 16 });
}

// Function to add markers to the map
function addMarkersToMap(locations) {
  markerClusterGroup.clearLayers(); // Clear existing markers
  // Check if there are any locations
  if (locations.length === 0) {
    console.log("No locations to show on the map.");
    return;
  }

  const bounds = [];

  locations.forEach((location) => {
    const marker = L.marker([location.latitude, location.longitude]);
    const popupContent = `
      <div>
        <h2>${location.title}</h2>
        <img src="${location.src}" alt="${
      location.title
    }" style="max-width: 100px; height: auto;">
        <p>${location.description}</p>
        <p><strong>Types:</strong> ${location.types.join(", ")}</p>
      </div>
    `;
    marker.bindPopup(popupContent);
    markerClusterGroup.addLayer(marker);
  });

  map.fitBounds(markerClusterGroup.getBounds());
}

async function renderLocations(locations) {
  try {
    const imageGrid = document.getElementById("image-grid");
    imageGrid.innerHTML = "";

    locations.forEach((location) => {
      const locationDiv = document.createElement("div");
      const totalVotes = location.likes + location.dislikes;
      const likePercentage =
        totalVotes === 0 ? 0 : (location.likes / totalVotes) * 100;
      const dislikePercentage =
        totalVotes === 0 ? 0 : (location.dislikes / totalVotes) * 100;
      locationDiv.className = "location";
      locationDiv.setAttribute("data-id", location._id);

      locationDiv.innerHTML = `
        <img src="${location.src}" alt="${location.title}">
        <div class="icon-buttons">
                        <button class="icon-button" onclick="likeLocation('${location._id}')">
                            <i class="fas fa-thumbs-up"></i>
                        </button>
                        <button class="icon-button" onclick="dislikeLocation('${location._id}')">
                            <i class="fas fa-thumbs-down"></i>
                        </button>
                        <button class="icon-button" onclick="saveFavorite('${location._id}')">
                            <i class="fas fa-star"></i>
                        </button>
                    </div>
        <h3>${location.title}</h3>
        <p>${location.description}</p>
        <div class="location-info">
        
              <div class="progress-bar">
                <span class="likes-count">Likes: ${location.likes}</span>
                <span class="dislikes-count">Dislikes: ${location.dislikes}</span>
                <div class="like-bar" style="width: ${likePercentage}%;"></div>
                <div class="dislike-bar" style="width: ${dislikePercentage}%;"></div>
              </div>
            </div>
        
      `;

      imageGrid.appendChild(locationDiv);
    });
  } catch (error) {
    console.error("Error rendering locations:", error);
  }
}

async function initializeApp() {
  // Initialize the map
  initializeMap();

  // Fetch locations from the backend
  const locations = await fetchLocations();

  // Add markers to the map
  addMarkersToMap(locations);

  // Render locations in the image grid
  renderLocations(locations);
}

// Call the initializeApp function to start the application
initializeApp();
// Function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in kilometers
  return distance;
}

// Function to get the user's current location
function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          console.log("User's current location:", userLocation);
          resolve(userLocation);
        },
        (error) => {
          console.error("Geolocation error:", error);
          reject(error);
        }
      );
    } else {
      const error = new Error("Geolocation is not supported by this browser.");
      console.error(error.message);
      reject(error);
    }
  });
}

// Function to update the distance value displayed and call filterLocations
function updateDistanceValue(value) {
  document.getElementById("distanceValue").textContent = value;
  console.log("Distance slider value (updateDistanceValue):", value); // Log distance slider value when it changes
  filterLocations(); // Call filterLocations whenever the slider value changes
}

document.addEventListener("DOMContentLoaded", () => {
  const distanceSliderValue = document.getElementById("distanceSlider").value;
  console.log(
    "Initial distance slider value (DOMContentLoaded):",
    distanceSliderValue
  ); // Log initial distance slider value
  updateDistanceValue(distanceSliderValue);
  filterLocations(); // Initial call to load locations based on user's location and default distance
});

// Function to filter locations based on checkboxes and update the title
async function filterLocations() {
  const checkCultura = document.getElementById("culturabtn");
  const checkNatureza = document.getElementById("naturezabtn");
  const checkPraia = document.getElementById("praiabtn");
  const checkTrilho = document.getElementById("trilhobtn");
  const checkMerendas = document.getElementById("merendasbtn");
  const filterTitle = document.getElementById("filterTitle");
  const campingnaturezaCheckbox = document.getElementById(
    "campingchecknatureza"
  );
  const distanceSlider = document.getElementById("distanceSlider");

  const distanceValue = distanceSlider.value;

  console.log("Distance slider value (filterLocations):", distanceValue); // Log distance slider value when filtering

  try {
    // Get user's current location
    const userLocation = await getCurrentLocation();

    // Fetch locations from backend
    const locations = await fetchLocations();

    // Create a copy of the original locations array
    let filteredLocations = [...locations];

    // Get all checkboxes
    const checkboxes = document.querySelectorAll(".ctime");

    // Add click event listener to each checkbox
    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener("click", function () {
        // Uncheck all checkboxes except the one that was clicked
        checkboxes.forEach((cb) => {
          if (cb !== this) {
            cb.checked = false;
          }
        });
        // Call the filter function
        applyFilters();
      });
    });

    // Function to apply filters
    function applyFilters() {
      // Reset filteredLocations to original locations array
      filteredLocations = [...locations];

      // Filter based on checked checkboxes
      if (checkCultura.checked) {
        filteredLocations = filteredLocations.filter((location) =>
          location.typeicon.includes("Cultura")
        );
        filterTitle.textContent = "Cultura";
      } else if (checkNatureza.checked) {
        filteredLocations = filteredLocations.filter((location) =>
          location.typeicon.includes("Natureza")
        );
        filterTitle.textContent = "Natureza";
      } else if (checkPraia.checked) {
        filteredLocations = filteredLocations.filter((location) =>
          location.typeicon.includes("Praia")
        );
        filterTitle.textContent = "Praia";
      } else if (checkTrilho.checked) {
        filteredLocations = filteredLocations.filter((location) =>
          location.typeicon.includes("Trilho")
        );
        filterTitle.textContent = "Trilho";
      } else if (checkMerendas.checked) {
        filteredLocations = filteredLocations.filter((location) =>
          location.typeicon.includes("Merendas")
        );
        filterTitle.textContent = "Merendas";
      } else {
        filterTitle.textContent = "Locais";
      }
      // Filter based on Merendas checkbox
      if (campingnaturezaCheckbox.checked) {
        filteredLocations = filteredLocations.filter((location) =>
          location.types.includes("WC")
        );
      }

      // Example: Filter based on distance slider value
      const updatedDistanceValue =
        document.getElementById("distanceSlider").value;
      console.log("Updated distance slider valuee:", updatedDistanceValue);

      filteredLocations = filteredLocations.filter((location) => {
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          location.latitude,
          location.longitude
        );

        return distance <= updatedDistanceValue;
      });

      // Clear current markers from map
      map.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          map.removeLayer(layer);
        }
      });

      // Add markers for filtered locations
      addMarkersToMap(filteredLocations);

      // Update the image grid with filtered locations
      renderLocations(filteredLocations);
    }

    // Initial call to apply filters in case any checkboxes are pre-checked
    applyFilters();
  } catch (error) {
    console.error("Error filtering locations:", error);
    // Handle error as needed
  }
}

// Debugging function to display the current local storage
function displayLocalStorage() {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const value = localStorage.getItem(key);
    console.log(`${key}: ${value}`);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Log the localStorage contents for debugging
  console.log("Local Storage Contents:");
  displayLocalStorage();
});

function updateLocationInUI(updatedLocation) {
  const locationDiv = document.querySelector(
    `[data-id="${updatedLocation._id}"]`
  );
  if (locationDiv) {
    const likesSpan = locationDiv.querySelector(".likes-count");
    if (likesSpan) {
      likesSpan.textContent = `Likes: ${updatedLocation.likes}`;
    }
    const dislikesSpan = locationDiv.querySelector(".dislikes-count");
    if (dislikesSpan) {
      dislikesSpan.textContent = `Dislikes: ${updatedLocation.dislikes}`;
    }
  } else {
    console.error("Location element not found in the UI.");
  }
}

async function likeLocation(locationId) {
  const token = localStorage.getItem("accessToken");
  console.log("Retrieved token:", token); // Debug log

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
    updateLocationInUI(updatedLocation); // Update the specific location in the UI
  } catch (error) {
    console.error("Failed to like location:", error);
  }
}

async function dislikeLocation(locationId) {
  const token = localStorage.getItem("accessToken");
  console.log("Retrieved token for dislike:", token); // Debug log

  if (!token) {
    console.error("No token found, please login first.");
    return;
  }

  try {
    const response = await fetch(
      `https://locals-v5-api.onrender.com/locations/${locationId}/dislike`,
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
    console.log("Location disliked:", updatedLocation);
    updateLocationInUI(updatedLocation); // Update the specific location in the UI
  } catch (error) {
    console.error("Failed to dislike location:", error);
  }
}

async function saveFavorite(locationId) {
  try {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      throw new Error("User is not authenticated");
    }

    const response = await fetch(
      `https://locals-v5-api.onrender.com/favorites/${locationId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Failed to save favorite");
    }

    const data = await response.json();
    console.log("Location saved to favorites:", data);
    alert("Location saved to favorites!");
  } catch (error) {
    console.error("Error saving favorite:", error);
    alert(`Failed to save favorite: ${error.message}`);
  }
}

// Debugging example to call likeLocation
// Call this function with an actual locationId when testing
// likeLocation("someLocationId");

// Function to handle the filter button click
function filterbtn() {
  var filtrosContainer = document.querySelector(".filtrosall");

  // Toggle the main filtros container visibility
  if (
    filtrosContainer.style.display === "none" ||
    filtrosContainer.style.display === ""
  ) {
    filtrosContainer.style.display = "block";
    showFilters();
  } else {
    filtrosContainer.style.display = "none";
    hideAllFilters();
  }
}

// Function to show individual filters based on checkboxes
function showFilters() {
  var filtrosNatureza = document.querySelector(".filtros-container-natureza");
  var checkNatureza = document.querySelector("#naturezabtn");
  var filtrosCultura = document.querySelector(".filtros-container-cultura");
  var checkCultura = document.querySelector("#culturabtn");
  var filtrosPraia = document.querySelector(".filtros-container-praia");
  var checkPraia = document.querySelector("#praiabtn");
  var filtrosTrilho = document.querySelector(".filtros-container-trilho");
  var checkTrilho = document.querySelector("#trilhobtn");
  var filtrosMerendas = document.querySelector(".filtros-container-merendas");
  var checkMerendas = document.querySelector("#merendasbtn");
  var verResults = document.querySelector(".showresults");

  // Show or hide individual filter sections based on checkboxes
  filtrosNatureza.style.display = checkNatureza.checked ? "block" : "none";
  filtrosCultura.style.display = checkCultura.checked ? "block" : "none";
  filtrosPraia.style.display = checkPraia.checked ? "block" : "none";
  filtrosTrilho.style.display = checkTrilho.checked ? "block" : "none";
  filtrosMerendas.style.display = checkMerendas.checked ? "block" : "none";
  verResults.style.display =
    checkNatureza.checked ||
    checkCultura.checked ||
    checkPraia.checked ||
    checkTrilho.checked ||
    checkMerendas.checked
      ? "block"
      : "none";
}

// Function to hide all filter sections
function hideAllFilters() {
  var filtrosNatureza = document.querySelector(".filtros-container-natureza");
  var filtrosCultura = document.querySelector(".filtros-container-cultura");
  var filtrosPraia = document.querySelector(".filtros-container-praia");
  var filtrosTrilho = document.querySelector(".filtros-container-trilho");
  var filtrosMerendas = document.querySelector(".filtros-container-merendas");
  var verResults = document.querySelector(".showresults");

  // Hide all filter sections
  filtrosNatureza.style.display = "none";
  filtrosCultura.style.display = "none";
  filtrosPraia.style.display = "none";
  filtrosTrilho.style.display = "none";
  filtrosMerendas.style.display = "none";
  verResults.style.display = "none";
}

// Add event listeners to the checkboxes to call showFilters on change
document.querySelector("#naturezabtn").addEventListener("change", showFilters);
document.querySelector("#culturabtn").addEventListener("change", showFilters);
document.querySelector("#praiabtn").addEventListener("change", showFilters);
document.querySelector("#trilhobtn").addEventListener("change", showFilters);
document.querySelector("#merendasbtn").addEventListener("change", showFilters);
function showResults() {
  // Get the element with the class 'filtros-filtros'
  var filtrosElement = document.querySelector(".filtrosall");
  var verResults = document.querySelector(".showresults");

  // Set the display property to 'none'
  if (filtrosElement) {
    filtrosElement.style.display = "none";
    verResults.style.display = "none";
  }
}

function login() {
  window.open("https://locals-v5-api.onrender.com/register", "_blank");
}

document
  .getElementById("registerForm")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const data = {};
    formData.forEach((value, key) => (data[key] = value));

    try {
      const response = await fetch(
        "https://locals-v5-api.onrender.com/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        }
      );

      if (response.ok) {
        console.log("User registered successfully");
        window.location.href = "https://locals-v1.onrender.com/login"; // Redirect to login page
      } else {
        console.error("Registration failed");
      }
    } catch (error) {
      console.error("Error:", error);
    }
  });

document
  .getElementById("loginForm")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const data = {};
    formData.forEach((value, key) => (data[key] = value));

    try {
      const response = await fetch("https://locals-v5-api.onrender.com/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        console.log("User logged in successfully");
        window.location.href = "https://locals-v1.onrender.com"; // Redirect to home page
      } else {
        console.error("Login failed");
      }
    } catch (error) {
      console.error("Error:", error);
    }
  });

// Call the filterbtn function to set up event listeners when the page loads
document.addEventListener("DOMContentLoaded", filterbtn);
// Call function to add markers to map with all locations initially
addMarkersToMap();

// Call function to populate the initial image grid
renderLocations();
