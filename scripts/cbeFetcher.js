const axios = require("axios");

async function fetchCBEData() {
  const { data } = await axios.get(
    "https://exchange-api-sepia.vercel.app/api/rates",
  );

  try {
    const response = await axios.get(myApiUrl);
    const data = response.data;

    if (data && data.price) {
      console.log("----------------------------");
      console.log("USD Price: " + data.price + " EGP");
      console.log("Updated successfully from server");
      console.log("----------------------------");

      return data.price;
    }
  } catch (error) {
    console.error("Error: Unable to connect to the server.");
  }
}

fetchCBEData();
