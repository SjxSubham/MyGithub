import { useState, useEffect, useRef } from "react";
import { IoSend } from "react-icons/io5";
import { toast } from "react-hot-toast";

const ChatWindow = ({ activeChat, authUser, socket, handleNewMessage }) => {
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const [showRepoInput, setShowRepoInput] = useState(false);
  const [issues, setIssues] = useState([]);
  const [prs, setPrs] = useState([]);
  const [gitHubToken, setGitHubToken] = useState("");
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [showIssuesSuggestions, setShowIssuesSuggestions] = useState(false);
  const [isLoadingIssues, setIsLoadingIssues] = useState(false);
  const messageEndRef = useRef(null);
  const issuesSuggestionRef = useRef(null);

  // Load GitHub token from localStorage if available
  useEffect(() => {
    const savedToken = localStorage.getItem("github_token");
    if (savedToken) {
      setGitHubToken(savedToken);
    }
  }, []);

  // Fetch chat messages when active chat changes
  useEffect(() => {
    const fetchMessages = async () => {
      if (!activeChat) return;

      try {
        setLoading(true);
        const response = await fetch(`/api/chat/messages/${activeChat._id}`, {
          credentials: "include",
        });
        const data = await response.json();

        if (response.ok) {
          setChatMessages(data);
        } else {
          toast.error("Failed to load messages");
        }
      } catch (error) {
        console.error("Error fetching messages:", error);
        toast.error("Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [activeChat]);

  // Listen for new messages from socket
  useEffect(() => {
    if (!socket || !activeChat) return;

    // Handle incoming message from socket
    const handleIncomingMessage = (data) => {
      if (data.conversationId === activeChat._id) {
        // Check if we already have a pending message with the same content
        // This could happen if both users are online and the message is sent/received
        const hasPendingMatch = chatMessages.some(
          (msg) =>
            msg.pending &&
            msg.message === data.message &&
            msg.sender === data.sender,
        );

        if (!hasPendingMatch) {
          setChatMessages((prev) => [...prev, data]);
        }

        // Also update the conversation's last message through parent component
        handleNewMessage(data);
      }
    };

    // Handle message delivery confirmation
    const handleMessageDelivered = (messageId) => {
      setChatMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId ? { ...msg, delivered: true } : msg,
        ),
      );
    };

    socket.on("receiveMessage", handleIncomingMessage);
    socket.on("messageDelivered", handleMessageDelivered);

    return () => {
      socket.off("receiveMessage", handleIncomingMessage);
      socket.off("messageDelivered", handleMessageDelivered);
    };
  }, [socket, activeChat, handleNewMessage, chatMessages]);

  // Auto scroll to bottom when messages update
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendMessage = async (e, retryMessage = null, retryId = null) => {
    e.preventDefault();

    if ((!message.trim() && !retryMessage) || !activeChat) return;

    // Get the receiver's username (the other participant)
    const receiver = activeChat.participants.find(
      (username) => username !== authUser.username,
    );

    if (!receiver) {
      toast.error("Cannot determine message recipient");
      return;
    }

    // Use retry message if provided, otherwise use the input field message
    const messageToSend = retryMessage || message.trim();

    // Function to send a message
    const sendMessageToServer = async (msgText, tempId = null) => {
      const isRetry = !!tempId;
      const tempMessageId = tempId || `temp-${Date.now()}`;

      // Extract issue references from message
      const extractedIssueRefs = [];
      const issueRegex = /#(\d+)\s\(([^)]+)\)/g;
      let match;

      while ((match = issueRegex.exec(msgText)) !== null) {
        extractedIssueRefs.push({
          issueNumber: parseInt(match[1]),
          title: match[2],
          type: match[2].toLowerCase().includes("pr") ? "pr" : "issue",
        });
      }

      // Create repo reference if we have a repo URL
      const repoReference = repoUrl ? extractRepoInfo(repoUrl) : null;

      // Create a temporary message with pending status if not retrying
      if (!isRetry) {
        const tempMessage = {
          _id: tempMessageId,
          sender: authUser.username,
          receiver,
          message: msgText,
          conversationId: activeChat._id,
          createdAt: new Date(),
          pending: true,
          issueReferences: extractedIssueRefs,
          repoReference,
        };

        // Add temporary message immediately for optimistic UI update
        setChatMessages((prev) => [...prev, tempMessage]);
      } else {
        // Mark message as pending again for retry
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg._id === tempId ? { ...msg, pending: true, failed: false } : msg,
          ),
        );
      }

      // Scroll to the new message
      messageEndRef.current?.scrollIntoView({ behavior: "smooth" });

      try {
        setSendingMessage(true);
        const response = await fetch("/api/chat/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            receiver,
            message: msgText,
            conversationId: activeChat._id,
            issueReferences:
              extractedIssueRefs.length > 0 ? extractedIssueRefs : undefined,
            repoReference,
          }),
          credentials: "include",
        });

        const data = await response.json();

        if (response.ok) {
          // Replace the temporary message with the actual message
          setChatMessages((prev) =>
            prev.map((msg) => (msg._id === tempMessageId ? data : msg)),
          );

          // Update the conversation's last message
          handleNewMessage({
            ...data,
            createdAt: new Date(),
          });

          // Emit message via socket
          socket.emit("sendMessage", {
            sender: authUser.username,
            receiver,
            message: msgText,
            conversationId: activeChat._id,
            messageId: data._id,
            issueReferences: extractedIssueRefs,
            repoReference,
          });
        } else {
          // Mark the message as failed
          setChatMessages((prev) =>
            prev.map((msg) =>
              msg._id === tempMessageId
                ? { ...msg, failed: true, pending: false }
                : msg,
            ),
          );
          toast.error(data.error || "Failed to send message");
        }
      } catch (error) {
        console.error("Error sending message:", error);
        // Mark the message as failed
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg._id === tempMessageId
              ? { ...msg, failed: true, pending: false }
              : msg,
          ),
        );
        toast.error("Something went wrong");
      } finally {
        setSendingMessage(false);
      }
    };

    if (!retryId) {
      // Create a temporary message with pending status
      const tempMessage = {
        _id: `temp-${Date.now()}`,
        sender: authUser.username,
        receiver,
        message: messageToSend,
        conversationId: activeChat._id,
        createdAt: new Date(),
        pending: true,
      };

      // Clear input field immediately if not retrying
      if (!retryMessage) {
        setMessage("");
      }

      // Send the message
      await sendMessageToServer(messageToSend, tempMessage._id);
    } else {
      // We're retrying an existing message
      await sendMessageToServer(messageToSend, retryId);
    }
  };

  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const extractRepoInfo = (url) => {
    try {
      const regex = /github\.com\/([^/]+)\/([^/]+)/;
      const match = url.match(regex);
      if (match && match.length >= 3) {
        return { owner: match[1], repo: match[2] };
      }
    } catch (error) {
      console.error("Error extracting repo info:", error);
    }
    return null;
  };

  const fetchIssuesAndPRs = async (repoUrl) => {
    const repoInfo = extractRepoInfo(repoUrl);
    if (!repoInfo) {
      toast.error("Invalid GitHub repository URL");
      return;
    }

    setIsLoadingIssues(true);
    try {
      console.log(`Fetching issues for ${repoInfo.owner}/${repoInfo.repo}...`);

      // Prepare headers for GitHub API request
      const headers = {};
      if (gitHubToken) {
        headers.Authorization = `token ${gitHubToken}`;
      }

      // Fetch issues with detailed error handling
      const issuesRes = await fetch(
        `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/issues?state=all&per_page=100&sort=updated`,
        { headers },
      );

      if (!issuesRes.ok) {
        let errorData = {};
        try {
          errorData = await issuesRes.json();
        } catch (e) {
          console.error("Failed to parse error response:", e);
        }

        console.error("GitHub API error:", {
          status: issuesRes.status,
          statusText: issuesRes.statusText,
          errorData,
        });

        if (issuesRes.status === 403) {
          toast.error(
            "GitHub API rate limit exceeded. Consider adding a personal access token.",
            { duration: 6000 },
          );
          setShowTokenInput(true);
        } else if (issuesRes.status === 404) {
          toast.error("Repository not found or private. Check the URL.");
        } else {
          toast.error(
            `GitHub API error: ${issuesRes.status} ${issuesRes.statusText}`,
          );
        }
        return;
      }

      const issuesData = await issuesRes.json();
      console.log(`Fetched ${issuesData.length} issues/PRs from GitHub API`);

      // Separate issues and PRs
      const fetchedIssues = issuesData.filter((item) => !item.pull_request);
      const fetchedPRs = issuesData.filter((item) => item.pull_request);

      setIssues(fetchedIssues);
      setPrs(fetchedPRs);
      toast.success(
        `Loaded ${fetchedIssues.length} issues and ${fetchedPRs.length} PRs from ${repoInfo.owner}/${repoInfo.repo}`,
      );
    } catch (error) {
      console.error("Error fetching issues/PRs:", error);
      toast.error(
        "Failed to load issues and PRs. Check if the repository is public and the URL is correct.",
      );
    } finally {
      setIsLoadingIssues(false);
    }
  };

  const handleMessageChange = (e) => {
    const value = e.target.value;
    setMessage(value);

    // Check if we should show issue suggestions
    if (value.includes("#")) {
      const lastHashPosition = value.lastIndexOf("#");
      const afterHash = value.slice(lastHashPosition + 1);

      console.log("Hash detected in message:", {
        lastHashPosition,
        afterHash,
        issuesLength: issues.length,
        prsLength: prs.length,
        showSuggestions: afterHash === "" || /^\d+$/.test(afterHash),
        messageValue: value,
      });

      // Only show suggestions if we're right after a # or typing a number
      if (afterHash === "" || /^\d+$/.test(afterHash)) {
        console.log("Showing issue suggestions", { issues, prs });
        setShowIssuesSuggestions(true);
      } else {
        setShowIssuesSuggestions(false);
      }
    } else {
      setShowIssuesSuggestions(false);
    }
  };

  const insertIssuePrReference = (item) => {
    const lastHashIndex = message.lastIndexOf("#");
    const beforeHash = message.substring(0, lastHashIndex);
    const afterNumber =
      message.substring(lastHashIndex).match(/^#\d*/)?.[0] || "#";
    const afterRest = message.substring(lastHashIndex + afterNumber.length);

    // Format: #123 (Title)
    const formattedReference = `#${item.number} (${item.title}) `;
    const newMessage = beforeHash + formattedReference + afterRest;

    setMessage(newMessage);
    setShowIssuesSuggestions(false);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        issuesSuggestionRef.current &&
        !issuesSuggestionRef.current.contains(event.target)
      ) {
        setShowIssuesSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Debug when issues or PRs change
  useEffect(() => {
    console.log(`Issues/PRs loaded:`, {
      issuesCount: issues.length,
      prsCount: prs.length,
      showSuggestions: showIssuesSuggestions,
      issuesList: issues
        .slice(0, 3)
        .map((i) => ({ number: i.number, title: i.title })),
      prsList: prs
        .slice(0, 3)
        .map((p) => ({ number: p.number, title: p.title })),
    });
  }, [issues, prs, showIssuesSuggestions]);

  if (!activeChat) {
    return (
      <div className="w-2/3 flex items-center justify-center h-screen bg-gray-800 text-gray-300">
        <div className="text-center">
          <div className="text-5xl mb-4">👋</div>
          <h2 className="text-2xl font-semibold">Select a conversation</h2>
          <p className="text-gray-500 mt-2">
            Choose a chat or start a new conversation
          </p>
        </div>
      </div>
    );
  }

  // Find other user details from active chat
  const otherUser = activeChat.participantDetails[0];

  return (
    <div className="w-2/3 flex flex-col h-screen bg-gray-800">
      {/* Chat header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center">
          {otherUser.avatarUrl ? (
            <img
              src={otherUser.avatarUrl}
              alt={otherUser.username}
              className="w-10 h-10 rounded-full mr-3"
            />
          ) : (
            <div className="w-10 h-10 rounded-full mr-3 bg-gray-700 flex items-center justify-center text-white font-medium">
              {otherUser.username.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-medium">
              {otherUser.name || otherUser.username}
            </div>
            <div className="text-sm text-gray-400">@{otherUser.username}</div>
          </div>
          <button
            onClick={() => setShowRepoInput(!showRepoInput)}
            className="ml-auto bg-gray-700 hover:bg-gray-600 text-xs px-2 py-1 rounded text-gray-200 flex items-center"
          >
            {showRepoInput ? "Hide Repo" : "Link Repo"}
            <svg
              className="w-4 h-4 ml-1"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25h-3.5a.25.25 0 0 1-.25-.25Z" />
            </svg>
          </button>
        </div>

        {showRepoInput && (
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex items-center">
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="Paste GitHub repo URL (e.g. https://github.com/username/repo)"
                className="flex-1 p-2 bg-gray-700 border border-gray-600 rounded text-gray-100 text-sm focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => {
                  console.log("Fetching issues for:", repoUrl);
                  fetchIssuesAndPRs(repoUrl);
                }}
                className="ml-2 bg-blue-600 px-3 py-2 rounded hover:bg-blue-700 text-sm"
                disabled={!repoUrl || !repoUrl.includes("github.com")}
              >
                Load Issues
              </button>
            </div>

            {(showTokenInput || gitHubToken) && (
              <div className="flex items-center">
                <input
                  type="password"
                  value={gitHubToken}
                  onChange={(e) => setGitHubToken(e.target.value)}
                  placeholder="GitHub personal access token (optional)"
                  className="flex-1 p-2 bg-gray-700 border border-gray-600 rounded text-gray-100 text-sm focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => {
                    if (gitHubToken) {
                      localStorage.setItem("github_token", gitHubToken);
                      toast.success("GitHub token saved");
                      if (repoUrl) fetchIssuesAndPRs(repoUrl);
                    } else {
                      setShowTokenInput(false);
                    }
                  }}
                  className="ml-2 bg-green-600 px-3 py-2 rounded hover:bg-green-700 text-sm"
                  disabled={!gitHubToken && !showTokenInput}
                >
                  {gitHubToken ? "Save & Use" : "Cancel"}
                </button>
              </div>
            )}

            {!showTokenInput && !gitHubToken && (
              <button
                onClick={() => setShowTokenInput(true)}
                className="self-start text-xs text-blue-400 hover:text-blue-300"
              >
                Add GitHub token (for higher rate limits)
              </button>
            )}
          </div>
        )}
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : chatMessages.length > 0 ? (
          <div className="space-y-3">
            {chatMessages.map((msg, index) => {
              const isCurrentUser = msg.sender === authUser.username;
              return (
                <div
                  key={msg._id || index}
                  className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      isCurrentUser
                        ? "bg-blue-600 text-white rounded-tr-none"
                        : "bg-gray-700 text-gray-100 rounded-tl-none"
                    } ${msg.pending ? "opacity-70" : ""} ${msg.failed ? "border border-red-500" : ""}`}
                  >
                    <div>
                      {msg.message
                        .split(/(#\d+\s\([^)]+\))/)
                        .map((part, index) => {
                          // Check if this part matches the pattern of an issue/PR reference
                          if (/^#\d+\s\([^)]+\)$/.test(part)) {
                            const isPR = part.toLowerCase().includes("pr");
                            return (
                              <span
                                key={index}
                                className={`${isPR ? "bg-purple-900/40" : "bg-green-900/40"} text-${isPR ? "purple" : "green"}-300 px-1 rounded mx-1`}
                              >
                                {part}
                              </span>
                            );
                          }
                          return <span key={index}>{part}</span>;
                        })}
                    </div>
                    <div
                      className={`text-xs mt-1 flex items-center ${isCurrentUser ? "text-blue-200" : "text-gray-400"}`}
                    >
                      {msg.pending ? (
                        <span className="flex items-center">
                          Sending...
                          <div className="ml-1 w-2 h-2 rounded-full bg-blue-200 animate-pulse"></div>
                        </span>
                      ) : msg.failed ? (
                        <span className="flex items-center">
                          <span className="text-red-300 mr-2">Failed</span>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              sendMessage(e, msg.message, msg._id);
                            }}
                            className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-0.5 rounded"
                          >
                            Retry
                          </button>
                        </span>
                      ) : (
                        <span className="flex items-center">
                          {formatMessageTime(msg.createdAt)}
                          {isCurrentUser && msg.delivered && (
                            <svg
                              className="w-3 h-3 ml-1 text-blue-300"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                            </svg>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messageEndRef} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            This is the beginning of your conversation with{" "}
            {otherUser.name || otherUser.username}
          </div>
        )}
      </div>

      {/* Message input */}
      <form
        onSubmit={(e) => sendMessage(e)}
        className="p-4 border-t border-gray-700 flex flex-col"
      >
        <div className="relative flex w-full">
          <input
            type="text"
            value={message}
            onChange={handleMessageChange}
            onKeyDown={(e) => {
              if (e.key === "#") {
                console.log("# key pressed", {
                  issues: issues.length,
                  prs: prs.length,
                });
                if (issues.length > 0 || prs.length > 0) {
                  setShowIssuesSuggestions(true);
                } else {
                  console.log("No issues or PRs available for suggestions");
                  toast.info(
                    "No issues or PRs loaded. Link a repo and load issues first.",
                  );
                }
              }
            }}
            placeholder={
              repoUrl
                ? "Type a message... (use # to reference issues/PRs)"
                : "Type a message..."
            }
            className="flex-1 p-2 bg-gray-700 border border-gray-600 rounded-l-lg focus:outline-none focus:border-blue-500 text-gray-100"
          />
          <button
            type="submit"
            className="bg-blue-600 px-4 rounded-r-lg flex items-center justify-center hover:bg-blue-700 transition-colors"
            disabled={!message.trim() || sendingMessage}
          >
            {sendingMessage ? (
              <div className="w-5 h-5 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
            ) : (
              <IoSend
                className={message.trim() ? "text-white" : "text-gray-300"}
              />
            )}
          </button>

          {/* Issues and PRs suggestions dropdown */}
          {showIssuesSuggestions && (
            <div
              ref={issuesSuggestionRef}
              className={`absolute bottom-full left-0 mb-2 w-full max-h-60 overflow-y-auto bg-gray-800 border ${issues.length === 0 && prs.length === 0 ? "border-red-500" : "border-gray-700"} rounded shadow-lg z-10`}
            >
              {issues.length > 0 && (
                <div className="p-2">
                  <div className="text-xs font-semibold text-gray-400 mb-1">
                    ISSUES
                  </div>
                  {issues
                    .filter((issue) => {
                      const searchText = message.substring(
                        message.lastIndexOf("#") + 1,
                      );
                      return (
                        searchText === "" ||
                        issue.number.toString().includes(searchText)
                      );
                    })
                    .slice(0, 5)
                    .map((issue) => (
                      <div
                        key={issue.id}
                        className="p-2 hover:bg-gray-700 cursor-pointer rounded text-sm flex items-center"
                        onClick={() => insertIssuePrReference(issue)}
                      >
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-200 text-green-800 mr-2">
                          Issue #{issue.number}
                        </span>
                        <span className="truncate">{issue.title}</span>
                      </div>
                    ))}
                </div>
              )}

              {prs.length > 0 && (
                <div className="p-2">
                  <div className="text-xs font-semibold text-gray-400 mb-1">
                    PULL REQUESTS
                  </div>
                  {prs
                    .filter((pr) => {
                      const searchText = message.substring(
                        message.lastIndexOf("#") + 1,
                      );
                      return (
                        searchText === "" ||
                        pr.number.toString().includes(searchText)
                      );
                    })
                    .slice(0, 5)
                    .map((pr) => (
                      <div
                        key={pr.id}
                        className="p-2 hover:bg-gray-700 cursor-pointer rounded text-sm flex items-center"
                        onClick={() => insertIssuePrReference(pr)}
                      >
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-200 text-purple-800 mr-2">
                          PR #{pr.number}
                        </span>
                        <span className="truncate">{pr.title}</span>
                      </div>
                    ))}
                </div>
              )}

              {isLoadingIssues && (
                <div className="p-4 text-center">
                  <div className="inline-block w-4 h-4 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin mr-2"></div>
                  Loading issues and PRs...
                </div>
              )}

              {!isLoadingIssues && issues.length === 0 && prs.length === 0 && (
                <div className="p-4 text-center text-gray-500">
                  {repoUrl ? (
                    <>
                      No issues or PRs found. Make sure the repository URL is
                      correct and public.
                    </>
                  ) : (
                    <>
                      Please link a GitHub repository first using the Link Repo
                      button above.
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {repoUrl && (
          <div className="mt-2 text-xs text-gray-400 flex items-center">
            <svg
              className="w-3 h-3 mr-1"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25h-3.5a.25.25 0 0 1-.25-.25Z" />
            </svg>
            Linked to {extractRepoInfo(repoUrl)?.owner}/
            {extractRepoInfo(repoUrl)?.repo}
            {issues.length > 0 || prs.length > 0
              ? ` (${issues.length} issues, ${prs.length} PRs)`
              : ""}
            <button
              onClick={() => {
                setRepoUrl("");
                setIssues([]);
                setPrs([]);
              }}
              className="ml-2 text-gray-500 hover:text-gray-300"
              type="button"
            >
              Unlink
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default ChatWindow;
