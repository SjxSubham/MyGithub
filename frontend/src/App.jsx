import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import SignUpPage from "./pages/SignUpPage";
import ExplorePage from "./pages/ExplorePage";
import LikesPage from "./pages/LikesPage";
import ChatPage from "./pages/ChatPage";

import Sidebar from "./components/Sidebar";
import { useAuthContext } from "./context/Auth.Context";
import Footer from "./components/Footer";
import UserProfile from "./components/UserProfile.jsx";

function App() {
  const { authUser, loading } = useAuthContext();
  console.log("Authenticated user:", authUser);

  if (loading) return null; // important point i need to min

  return (
    <div className="flex">
      <Sidebar />
      <div className="max-w-5xl my-5 text-white mx-auto transition-all duration-300 flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/login"
            element={!authUser ? <LoginPage /> : <Navigate to={"/"} />}
          />
          <Route
            path="/signup"
            element={!authUser ? <SignUpPage /> : <Navigate to={"/"} />}
          />
          <Route
            path="/explore"
            element={authUser ? <ExplorePage /> : <Navigate to={"/login"} />}
          />
          <Route
            path="/likes"
            element={authUser ? <LikesPage /> : <Navigate to={"/login"} />}
          />
          <Route
            path="/chat"
            element={authUser ? <ChatPage /> : <Navigate to={"/login"} />}
          />
          <Route
            path="/profile"
            element={authUser ? <UserProfile /> : <Navigate to={"/login"} />}
          />
        </Routes>
        <Toaster />
        <Footer />
      </div>
    </div>
  );
}

export default App;
