import React, { useState, useEffect } from "react";
import {
  Platform,
  Text,
  View,
  StyleSheet,
  Pressable,
  Alert,
  TextInput,
  Image,
  ActivityIndicator,
} from "react-native";
import * as Device from "expo-device";
import * as Location from "expo-location";
import MapView, { Marker } from "react-native-maps";
import moment from "moment-timezone";
import axios from "axios";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";

const Tab = createBottomTabNavigator();

function HomeScreen({ user, location, isFetchingLocation, sendCheckIn, isSendingData }) {
  return (
    <View style={styles.container}>
      {user && (
        <>
          {user.photo && (
            <Image
              source={{ uri: user.photo }}
              style={styles.userPhoto}
            />
          )}
          <Text style={styles.userInfo}>
            Welcome, {user.name} ({user.email})
          </Text>
          {isFetchingLocation ? (
            <ActivityIndicator size="large" color="#1E90FF" />
          ) : location ? (
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
              }}
            >
              <Marker
                coordinate={{
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                }}
                title={"You are here"}
              />
            </MapView>
          ) : (
            <Text style={styles.paragraph}>Waiting for location...</Text>
          )}
          {isSendingData ? (
            <ActivityIndicator size="large" color="#1E90FF" />
          ) : (
            <>
              <Pressable
                style={[styles.pressableButton, styles.checkInButton]}
                onPress={() => sendCheckIn("in")}
              >
                <Text style={styles.buttonText}>Check In</Text>
              </Pressable>
              <Pressable
                style={[styles.pressableButton, styles.checkOutButton]}
                onPress={() => sendCheckIn("out")}
              >
                <Text style={styles.buttonText}>Check Out</Text>
              </Pressable>
            </>
          )}
        </>
      )}
    </View>
  );
}

function SettingsScreen({ handleLogout }) {
  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.pressableButton, styles.logoutButton]}
        onPress={handleLogout}
      >
        <Text style={styles.buttonText}>Logout</Text>
      </Pressable>
    </View>
  );
}

export default function App() {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isSendingData, setIsSendingData] = useState(false);

  useEffect(() => {
    if (isLoggedIn) {
      (async () => {
        setIsFetchingLocation(true);
        try {
          // Check if device
          if (Platform.OS === "android" && !Device.isDevice) {
            setErrorMsg(
              "Oops, this will not work on Snack in an Android Emulator. Try it on your device!"
            );
            return;
          }

          // Request permission for location
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== "granted") {
            setErrorMsg("Permission to access location was denied");
            setIsFetchingLocation(false);
            return;
          }

          // Get location
          let location = await Location.getCurrentPositionAsync({});
          setLocation(location);
        } catch (error) {
          console.error("Location error:", error); // Log error
          Alert.alert("Error", "Failed to fetch location");
        } finally {
          setIsFetchingLocation(false);
        }
      })();
    }
  }, [isLoggedIn]);

  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleLogin = async () => {
    if (!isValidEmail(email)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post("https://dot.mhubmw.tech/api/login", {
        username: email,
        password,
      });
      if (response.data.status === "success") {
        setUser(response.data.user);
        setIsLoggedIn(true);
      } else {
        Alert.alert("Login Failed", response.data.message);
      }
    } catch (error) {
      console.error("Login error:", error); // Log error
      Alert.alert("Login Failed", "An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const sendCheckIn = async (type) => {
    if (!location) {
      Alert.alert("Error", "Location not available");
      return;
    }

    setIsSendingData(true);
    const { latitude, longitude } = location.coords;
    const currentTimeInBlantyre = moment().tz("Africa/Blantyre");
    const date = currentTimeInBlantyre.format("YYYY-MM-DD");
    const time = currentTimeInBlantyre.format("HH:mm:ss");

    try {
      const geoResponse = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=AIzaSyDp0U_NV_mbbUFbzyso_c854jBjq0B2U10`
      );
      const placeName =
        geoResponse.data.results[0]?.formatted_address || "Unknown Place";
      const compoundCode =
        geoResponse.data.results[0]?.plus_code?.compound_code || "Unknown Code";

      const response = await axios.post("https://dot.mhubmw.tech/api/savedata", {
        type,
        date,
        time,
        latitude,
        longitude,
        placeName,
        compoundCode,
        userName: user.name,
        userEmail: user.email,
      });

      if (response.status === 400) {
        Alert.alert("Check-In/Out Error", response.data.message || "You have already checked in/out today");
      } else if (response.data.status === "success") {
        Alert.alert("Success", `Checked ${type} successfully at ${placeName}`);
      } else {
        Alert.alert("Error", response.data.message || "You have already checked in/out today");
      }
    } catch (error) {
      console.error("Check-in error:", error); // Log error
      Alert.alert("Error", "Something went wrong");
    } finally {
      setIsSendingData(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setEmail("");
    setPassword("");
    setUser(null);
    setLocation(null);
  };

  if (!isLoggedIn) {
    return (
      <View style={styles.container}>
        <Image
          source={{
            uri: "http://mhubmw.com/wp-content/uploads/2020/10/mhub-Logo.png",
          }}
          style={styles.logo}
        />
        <Text style={styles.paragraph}>Login</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {isLoading ? (
          <ActivityIndicator size="large" color="#1E90FF" />
        ) : (
          <Pressable
            style={[
              styles.pressableButton,
              styles.loginButton,
              !isValidEmail(email) && styles.disabledButton,
            ]}
            onPress={handleLogin}
            disabled={!isValidEmail(email)}
          >
            <Text style={styles.buttonText}>Login</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;
            if (route.name === "Home") {
              iconName = focused ? "home" : "home-outline";
            } else if (route.name === "Settings") {
              iconName = focused ? "settings" : "settings-outline";
            }
            return <Ionicons name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Home">
          {(props) => (
            <HomeScreen
              {...props}
              user={user}
              location={location}
              isFetchingLocation={isFetchingLocation}
              sendCheckIn={sendCheckIn}
              isSendingData={isSendingData}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="Settings">
          {(props) => <SettingsScreen {...props} handleLogout={handleLogout} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  map: {
    width: "100%",
    height: 300,
  },
  userPhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 20,
  },
  paragraph: {
    margin: 24,
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  input: {
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
    marginBottom: 20,
    paddingHorizontal: 10,
    width: "80%",
  },
  pressableButton: {
    padding: 10,
    borderRadius: 5,
    marginVertical: 5,
    width: 200,
    alignItems: "center",
  },
  checkInButton: {
    backgroundColor: "green",
  },
  checkOutButton: {
    backgroundColor: "red",
  },
  logoutButton: {
    backgroundColor: "orange",
  },
  loginButton: {
    backgroundColor: "#1E90FF",
  },
  disabledButton: {
    backgroundColor: "#A9A9A9",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
  },
  userInfo: {
    marginBottom: 10,
    fontSize: 18,
    textAlign: "center",
  },
  logo: {
    width: 200,
    height: 100,
    marginBottom: 20,
  },
});
