const express = require("express")
const axios = require("axios")
const app = express()

// Set the view engine to EJS
app.set("view engine", "ejs")

// Serve the public folder as static files
app.use(express.static("public"))

// API Keys - Make sure to set these environment variables
//const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || "659fe52bb3dbf87b1602a5f0dc8fd1c9"
//const ABSTRACT_API_KEY = process.env.ABSTRACT_API_KEY || "8abf69ad0ac047a69628fedcb5beef96"

// Function to get weather data by city name
async function getWeatherDataByCity(city, apiKey) {
  const APIUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=imperial&appid=${apiKey}`
  try {
    const response = await axios.get(APIUrl)
    return { weather: response.data, error: null }
  } catch (error) {
    return { weather: null, error: "Error, Please try again" }
  }
}

// Function to get weather data by coordinates
async function getWeatherDataByCoords(lat, lon, apiKey) {
  const APIUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${apiKey}`
  try {
    const response = await axios.get(APIUrl)
    return { weather: response.data, error: null }
  } catch (error) {
    return { weather: null, error: "Error, Please try again" }
  }
}

// Primary location service - ipapi.co
async function getLocationFromIpapi(ip) {
  try {
    const response = await axios.get(`https://ipapi.co/${ip}/json/`)
    if (response.data.error) {
      throw new Error(response.data.reason)
    }
    return {
      success: true,
      data: {
        city: response.data.city,
        lat: response.data.latitude,
        lon: response.data.longitude,
      },
    }
  } catch (error) {
    console.error("ipapi.co error:", error)
    return { success: false }
  }
}

// Secondary location service - abstractapi.com
async function getLocationFromAbstractApi(ip) {
  try {
    const response = await axios.get(
      `https://ipgeolocation.abstractapi.com/v1/?api_key=${ABSTRACT_API_KEY}&ip_address=${ip}`,
    )
    if (response.data.error) {
      throw new Error(response.data.error.message)
    }
    return {
      success: true,
      data: {
        city: response.data.city,
        lat: response.data.latitude,
        lon: response.data.longitude,
      },
    }
  } catch (error) {
    console.error("AbstractAPI error:", error)
    return { success: false }
  }
}

// Tertiary location service - ip-api.com
async function getLocationFromIpApi(ip) {
  try {
    const response = await axios.get(`http://ip-api.com/json/${ip}`)
    if (response.data.status === "fail") {
      throw new Error(response.data.message)
    }
    return {
      success: true,
      data: {
        city: response.data.city,
        lat: response.data.lat,
        lon: response.data.lon,
      },
    }
  } catch (error) {
    console.error("ip-api.com error:", error)
    return { success: false }
  }
}

// Combined location detection with fallbacks
async function getLocation(ip) {
  // Try primary service
  const ipapiResult = await getLocationFromIpapi(ip)
  if (ipapiResult.success) {
    return ipapiResult
  }

  // Try secondary service
  const abstractResult = await getLocationFromAbstractApi(ip)
  if (abstractResult.success) {
    return abstractResult
  }

  // Try tertiary service
  const ipApiResult = await getLocationFromIpApi(ip)
  if (ipApiResult.success) {
    return ipApiResult
  }

  // All services failed
  return {
    success: false,
    data: {
      city: "New York", // Default city
      lat: 40.7128,
      lon: -74.006,
    },
  }
}

// Render the index template with default values for weather and error
app.get("/", async (req, res) => {
  // Get user's IP address
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.connection.remoteAddress

  // Try to get the user's location using multiple services
  const locationResult = await getLocation(ip)
  const location = locationResult.data

  // Fetch weather data for the detected or default location
  const { weather, error } = await getWeatherDataByCoords(location.lat, location.lon, OPENWEATHER_API_KEY)

  res.render("index", {
    weather,
    error,
    defaultCity: location.city,
    locationSource: locationResult.success ? "detected" : "default",
  })
})

// Handle the /weather route
app.get("/weather", async (req, res) => {
  let weather, error, defaultCity

  if (req.query.lat && req.query.lon) {
    // If coordinates are provided, use them
    const { lat, lon } = req.query
    ;({ weather, error } = await getWeatherDataByCoords(lat, lon, OPENWEATHER_API_KEY))
    defaultCity = weather ? weather.name : "Unknown Location"
  } else if (req.query.city) {
    // If a city name is provided, use it
    const city = req.query.city
    ;({ weather, error } = await getWeatherDataByCity(city, OPENWEATHER_API_KEY))
    defaultCity = city
  } else {
    // If neither coordinates nor city name is provided, return an error
    error = "Please provide a city name or use your location."
    defaultCity = "Enter city name"
  }

  res.render("index", {
    weather,
    error,
    defaultCity,
    locationSource: "manual",
  })
})

// Start the server and listen on port 3000 or the value of the PORT environment variable
const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`App is running on port ${port}`)
})

