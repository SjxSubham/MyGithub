import { useState, useEffect } from "react";
import { IoChatboxEllipses } from "react-icons/io5";
import { FaSearch } from "react-icons/fa";
import { BsCircleFill } from "react-icons/bs";

const ChatSidebar = ({
  conversations,
  activeChat,
  setActiveChat,
  onlineUsers,
  loading,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [allUsers, setAllUsers] = useState([]);

  useEffect(() => {
    const fetchAllUsers = async () => {
      try {
        const response = await fetch("/api/chat/users", {
          credentials: "include",
        });
        const data = await response.json();

        if (response.ok) {
          setAllUsers(data);
        }
      } catch (error) {
        console.error("Failed to fetch users:", error);
      }
    };

    fetchAllUsers();
  }, []);

  const handleSearch = async (e) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);

    if (query.length > 0) {
      setIsSearching(true);
      const results = allUsers.filter(
        (user) =>
          user.username.toLowerCase().includes(query) ||
          (user.name && user.name.toLowerCase().includes(query)),
      );
      setSearchResults(results);
    } else {
      setIsSearching(false);
    }
  };

  const startNewChat = async (username) => {
    try {
      const response = await fetch(`/api/chat/conversation/${username}`, {
        credentials: "include",
      });
      const data = await response.json();

      if (response.ok) {
        // Find if there's already a conversation in the list
        const existingConvIndex = conversations.findIndex(
          (c) => c._id === data._id,
        );

        if (existingConvIndex === -1) {
          // If not, add the new conversation with user details
          const userDetails = allUsers.find((u) => u.username === username);
          const newConversation = {
            ...data,
            participantDetails: [userDetails],
          };
          setActiveChat(newConversation);
        } else {
          // If exists, set it as active chat
          setActiveChat(conversations[existingConvIndex]);
        }

        setSearchQuery("");
        setIsSearching(false);
      }
    } catch (error) {
      console.error("Failed to create conversation:", error);
    }
  };

  const formatLastMessageTime = (timestamp) => {
    if (!timestamp) return "";

    const date = new Date(timestamp);
    const now = new Date();
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      // Today, show time only
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffInDays === 1) {
      return "Yesterday";
    } else if (diffInDays < 7) {
      // Within the last week, show day name
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      // More than a week ago, show date
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  return (
    <div className="w-1/3 border-r border-gray-700 bg-gray-900 text-gray-100 h-screen overflow-y-auto bg-glass">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-bold mb-4 flex items-center">
          <IoChatboxEllipses className="mr-2" /> Chats
        </h2>
        <div className="relative">
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={handleSearch}
            className="w-full p-2 pl-8 rounded bg-gray-800 text-gray-200 border border-gray-700 focus:outline-none focus:border-blue-500"
          />
          <FaSearch className="absolute top-3 left-2 text-gray-500" />
        </div>
      </div>

      {/* Search results */}
      {isSearching ? (
        <div className="p-2">
          <h3 className="text-sm text-gray-500 mb-2">Search Results</h3>
          {searchResults.length > 0 ? (
            <div>
              {searchResults.map((user) => (
                <div
                  key={user.username}
                  className="flex items-center p-3 hover:bg-gray-800 rounded cursor-pointer"
                  onClick={() => startNewChat(user.username)}
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.username}
                      className="w-10 h-10 rounded-full mr-3"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full mr-3 bg-gray-700 flex items-center justify-center text-white font-medium">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-medium">
                      {user.name || user.username}
                    </div>
                    <div className="text-sm text-gray-400">
                      @{user.username}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-4">No users found</div>
          )}
        </div>
      ) : (
        // Conversations list
        <div className="p-2 ">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : conversations.length > 0 ? (
            <div>
              {conversations.map((conversation) => {
                const otherUser = conversation.participantDetails[0];
                const isOnline = onlineUsers.includes(otherUser.username);
                const isActive =
                  activeChat && activeChat._id === conversation._id;

                return (
                  <div
                    key={conversation._id}
                    className={`flex items-center p-3 rounded cursor-pointer ${
                      isActive ? "bg-gray-800" : "hover:bg-gray-800"
                    }`}
                    onClick={() => setActiveChat(conversation)}
                  >
                    <div className="relative">
                      {otherUser.avatarUrl ? (
                        <img
                          src={otherUser.avatarUrl}
                          alt={otherUser.username}
                          className="w-12 h-12 rounded-full mr-3"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full mr-3 bg-gray-700 flex items-center justify-center text-white font-medium">
                          {otherUser.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {isOnline && (
                        <BsCircleFill className="absolute bottom-0 right-2 text-green-500 text-xs" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">
                        {otherUser.name || otherUser.username}
                      </div>
                      <div className="text-sm text-gray-400 truncate">
                        {conversation.lastMessage || "Start a conversation"}
                      </div>
                    </div>
                    {conversation.lastMessageTime && (
                      <div className="text-xs text-gray-500 ml-2">
                        {formatLastMessageTime(conversation.lastMessageTime)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              No conversations yet. Start by searching for a user.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatSidebar;
