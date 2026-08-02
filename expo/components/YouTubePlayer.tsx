import { Platform } from "react-native";
import NativeYouTubePlayer from "@/components/YouTubePlayer.native";
import WebYouTubePlayer from "@/components/YouTubePlayer.web";

const YouTubePlayer = Platform.OS === "web" ? WebYouTubePlayer : NativeYouTubePlayer;

export default YouTubePlayer;
