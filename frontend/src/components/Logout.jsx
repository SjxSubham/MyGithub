import { useEffect } from "react";
import { toast } from "react-hot-toast";
import { CiLogout } from "react-icons/ci";
import { useAuthContext } from "../context/Auth.Context";
const Logout = ({ userProfile }) => {
  const { authUser, setAuthUser } = useAuthContext();

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { credentials: "include" });
      await res.json();
      // Response processed successfully
      setAuthUser(null);
    } catch (error) {
      toast.error(error.message);
    }
  };
  return (
    <>
      {(userProfile || authUser) && (
        <img
          alt="User avatar"
          src={userProfile?.avatarUrl || authUser?.avatarUrl}
          className="w-10 h-10 rounded-full mb-2 border border-gray-800"
        />
      )}

      <div
        className="cursor-pointer flex items-center p-2 border-spacing-1 border-gray-500 last:rounded-lg bg-glass mt-auto"
        onClick={handleLogout}
      >
        <CiLogout size={22} />
      </div>
    </>
  );
};

export default Logout;
