import { useState } from "react";
import {
  Image,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  View,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Camera } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";
// import { loadTensorflowModel, useTensorflowModel } from 'react-native-fast-tflite'; // provides our hook: useTensorflowModel
import jpeg from "jpeg-js"; // installed via npm install jpeg-js
import { Buffer } from "buffer"; // for converting base64 to a buffer


// Utility: Convert JPEG-base64 to a normalized Float32Array tensor for a [1,32,32,3] input.
// This function:
// 1. Decodes the base64 JPEG into raw RGBA pixels using jpeg-js.
// 2. Removes the alpha channel.
// 3. Normalizes the values (here: dividing by 255). Adjust normalization as needed.
const convertImageToTensor = (base64: string): Float32Array => {
  // Decode the JPEG image (true = return as Uint8Array)
  const rawImageData = jpeg.decode(Buffer.from(base64, "base64"), { useTArray: true });
  const { width, height, data } = rawImageData; // data is in RGBA order

  // We expect to receive a 32x32 image; if not, there's an issue.
  if (width !== 32 || height !== 32) {
    throw new Error("Unexpected image dimensions. Expected 32x32.");
  }

  // Create a Float32Array for our normalized RGB tensor.
  // Model input shape: [1, 32, 32, 3] → total elements = 1 * 32 * 32 * 3.
  const tensor = new Float32Array(32 * 32 * 3);

  // Iterate over each pixel and copy the R, G, B values,
  // Normalizing by dividing by 255.
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    tensor[j] = data[i] / 255;     // Red
    tensor[j + 1] = data[i + 1] / 255; // Green
    tensor[j + 2] = data[i + 2] / 255; // Blue
    // Skip alpha: data[i+3]
  }

  return tensor;
};

function Home() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [prediction, setPrediction] = useState<string | null>(null);

  // Load the model using the hook.
  // When using a local asset, use require.
  // const modelPlugin = useTensorflowModel(
  //   require("../../assets/yoruba_ocr_model.tflite"),

  // );

  // Pick an image from the gallery.
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Media library permission is required!");
      return;
    }

    const pickResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 1,
    });

    if (!pickResult.canceled) {
      const uri = pickResult.assets[0].uri;
      setImageUri(uri);
      setResult(null);
      await handlePrediction(uri);
    }
  };

  // Capture a photo with the camera.
  const takePhoto = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Camera permission is required!");
      return;
    }

    const photoResult = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 1,
    });

    if (!photoResult.canceled) {
      const uri = photoResult.assets[0].uri;
      setImageUri(uri);
      setResult(null);
      await handlePrediction(uri);
    }
  };

  // Process the image, run prediction, and update the UI with the result.
  const handlePrediction = async (uri: string) => {
    // Check that the model is loaded.
    // if (!modelPlugin || modelPlugin.state !== "loaded") {
    //   console.error("Model is not loaded yet.");
    //   Alert.alert("Error", "Model is not loaded yet.");
    //   return;
    // }

    try {
      // 1. Resize the image to 32x32 using expo-image-manipulator.
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 32, height: 32 } }],
        { base64: true } // Request base64-encoded output
      );

      if (!manipulated.base64) {
        throw new Error("Failed to get base64 image.");
      }

      // 2. Convert the base64 JPEG to a normalized tensor.
      const inputTensor = convertImageToTensor(manipulated.base64);
      // Note: inputTensor has shape [32*32*3] (flattened). Your model might expect a nested structure.
      // You may need to reshape it on the native side. Most TFLite integrations expect flattened data.

      // 3. Run inference. Here we’re calling the low-level .run method on the model.
      // Pass the input wrapped in an array if the API expects a list of inputs.
      // The result is typically an array corresponding to the model output(s).
      // const prediction = await modelPlugin.model.run([inputTensor]);
      // console.log("Prediction result:", prediction);

      // Handle output. Here we assume prediction is an array of outputs and we want to show the first value.
      if (prediction && prediction.length > 0) {
        setResult(`Prediction: ${prediction[0]}`);
      } else {
        setResult("No prediction result");
      }
    } catch (error) {
      console.error("Error during prediction:", error);
      Alert.alert("Error", "Failed to process the image.");
    }
  };

   // Clear current image and prediction – for a fresh start.
   const handleClear = () => {
    setImageUri(null);
    setPrediction(null);
  };

  return (
    <SafeAreaView style={styles.container}>
    <Text style={styles.header}>Yoruba OCR</Text>

    {/* Action buttons for image selection */}
    {!imageUri && (
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
          <Text style={styles.actionText}>Select Image</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={takePhoto}>
          <Text style={styles.actionText}>Capture Photo</Text>
        </TouchableOpacity>
      </View>
    )}

    {/* Display image preview along with subsequent action buttons */}
    {imageUri && (
      <View style={styles.previewContainer}>
        <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="contain" />
        <View style={styles.buttonGroup}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleClear}>
            <Text style={styles.buttonText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={() => handlePrediction(imageUri)}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Predict</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    )}

    {/* Show prediction result */}
    {prediction && (
      <View style={styles.predictionContainer}>
        <Text style={styles.predictionText}>{prediction}</Text>
      </View>
    )}
  </SafeAreaView>
  );
}

export default Home

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
    alignItems: "center",
    padding: 20,
  },
  header: {
    fontSize: 28,
    fontWeight: "700",
    marginVertical: 20,
    color: "#333",
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginVertical: 10,
  },
  actionButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  actionText: {
    color: "#fff",
    fontSize: 16,
  },
  previewContainer: {
    width: "100%",
    alignItems: "center",
    marginVertical: 20,
  },
  imagePreview: {
    width: 250,
    height: 250,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  buttonGroup: {
    flexDirection: "row",
    marginTop: 15,
  },
  primaryButton: {
    backgroundColor: "#007BFF",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginHorizontal: 5,
    minWidth: 120,
    alignItems: "center",
  },
  secondaryButton: {
    backgroundColor: "#FFC107",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginHorizontal: 5,
    minWidth: 120,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  predictionContainer: {
    backgroundColor: "#e9ecef",
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
    width: "100%",
    alignItems: "center",
  },
  predictionText: {
    fontSize: 18,
    color: "#333",
  },
});
