"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "./ui/avatar";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { formatDistanceToNow } from "date-fns";
import { useUser } from "@/lib/AuthContext";
import { auth } from "@/lib/firebase";
import axiosInstance from "@/lib/axiosinstance";
import EmojiPicker from "emoji-picker-react";

interface Comment {
  _id: string;
  videoid: string;
  userid: string;
  commentbody: string;
  usercommented: string;
  commentedon: string;
  location?: string;
  showLocation?: boolean;
  likedBy?: string[];
  dislikedBy?: string[];
  reportedBy?: string[];
  reportCount?: number;
  reported?: boolean;
}

interface CommentsProps {
  videoId: string;
  user?: any;
  authLoading?: boolean;
}

const Comments = ({
  videoId,
  user: propUser,
  authLoading: propAuthLoading,
}: CommentsProps) => {
  const authContext = useUser() as any;

  // Resolve active user from props, context, firebase auth SDK, or localStorage
  const activeUser = useMemo(() => {
    let resolved = null;
    if (propUser && (propUser._id || propUser.uid || propUser.email)) {
      resolved = propUser;
    } else if (authContext?.user && (authContext.user._id || authContext.user.uid || authContext.user.email)) {
      resolved = authContext.user;
    } else if (authContext?.currentUser && (authContext.currentUser._id || authContext.currentUser.uid || authContext.currentUser.email)) {
      resolved = authContext.currentUser;
    } else if (auth?.currentUser) {
      resolved = {
        _id: auth.currentUser.uid,
        uid: auth.currentUser.uid,
        name: auth.currentUser.displayName || auth.currentUser.email?.split("@")[0] || "User",
        displayName: auth.currentUser.displayName || auth.currentUser.email?.split("@")[0] || "User",
        email: auth.currentUser.email,
        image: auth.currentUser.photoURL || "",
      };
    } else {
      try {
        const stored = localStorage.getItem("user");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && (parsed._id || parsed.uid || parsed.email)) resolved = parsed;
        }
      } catch (_) {}
    }

    if (resolved) {
      return {
        ...resolved,
        _id: resolved._id || resolved.uid,
        uid: resolved.uid || resolved._id,
        name: resolved.name || resolved.displayName || resolved.email?.split("@")[0] || "User",
      };
    }
    return null;
  }, [propUser, authContext?.user, authContext?.currentUser]);

  // Alias for backward compatibility with child components & handlers
  const user = activeUser;
  const isAuthInitializing = propAuthLoading ?? authContext?.loading ?? false;

  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentError, setCommentError] = useState("");
  const [commentSuccess, setCommentSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const [location, setLocation] = useState("");
  const [showLocation, setShowLocation] = useState(false);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const [editingCommentId, setEditingCommentId] =
    useState<string | null>(null);

  const [editText, setEditText] = useState("");

  const [translationMenu, setTranslationMenu] =
    useState<string | null>(null);

  const [translationLanguages, setTranslationLanguages] =
    useState<{ [key: string]: string }>({});

  const [translatedComments, setTranslatedComments] =
    useState<{ [key: string]: string }>({});

  const [translatingComment, setTranslatingComment] =
    useState<string | null>(null);

  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  /* =========================
     LOAD COMMENTS
  ========================= */

  useEffect(() => {
    loadComments();
  }, [videoId]);

  const loadComments = async () => {
    try {
      const res = await axiosInstance.get(
        `/comment/${videoId}`
      );

      setComments(res.data || []);
    } catch (error) {
      console.error("Error loading comments:", error);
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     CLEAR MESSAGES
  ========================= */

  const clearMessages = () => {
    setCommentError("");
    setCommentSuccess("");
  };

  /* =========================
     POST COMMENT
  ========================= */

  const handleSubmitComment = async () => {
    clearMessages();

    // 1. Is user logged in? Wait for auth initialization if in progress
    let userToUse = activeUser;
    if (!userToUse && (isAuthInitializing || authContext?.loading)) {
      for (let i = 0; i < 6; i++) {
        await new Promise((res) => setTimeout(res, 100));
        if (auth?.currentUser) {
          userToUse = {
            _id: auth.currentUser.uid,
            uid: auth.currentUser.uid,
            name: auth.currentUser.displayName || auth.currentUser.email?.split("@")[0] || "User",
            displayName: auth.currentUser.displayName || auth.currentUser.email?.split("@")[0] || "User",
            email: auth.currentUser.email,
            image: auth.currentUser.photoURL || "",
          };
          break;
        }
      }
    }

    if (!userToUse && auth?.currentUser) {
      userToUse = {
        _id: auth.currentUser.uid,
        uid: auth.currentUser.uid,
        name: auth.currentUser.displayName || auth.currentUser.email?.split("@")[0] || "User",
        displayName: auth.currentUser.displayName || auth.currentUser.email?.split("@")[0] || "User",
        email: auth.currentUser.email,
        image: auth.currentUser.photoURL || "",
      };
    }

    if (!userToUse) {
      setCommentError("Please log in before commenting.");
      return;
    }

    // 2. Is video ID available?
    if (!videoId) {
      setCommentError("Video not found. Unable to comment.");
      return;
    }

    // 3. & 4. Is comment text present and not only whitespace?
    if (typeof newComment !== "string") {
      setCommentError("Comment cannot be empty.");
      return;
    }
    const trimmed = newComment.trim();
    if (!trimmed) {
      setCommentError("Comment cannot be empty.");
      return;
    }

    // 5. Abusive-content detection
    const abusiveWords = [
      "idiot",
      "stupid",
      "fool",
      "bitch",
      "shit",
      "fuck",
      "asshole",
      "bastard",
    ];
    const hasAbusive = abusiveWords.some((w) =>
      new RegExp(`\\b${w}\\b`, "i").test(trimmed)
    );
    if (hasAbusive) {
      setCommentError(
        "This comment was blocked because it contains prohibited language."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const resolvedUserId =
        userToUse?._id || userToUse?.uid || userToUse?.id || auth?.currentUser?.uid;
      const resolvedUserName =
        userToUse?.name ||
        userToUse?.displayName ||
        userToUse?.username ||
        auth?.currentUser?.displayName ||
        userToUse?.email?.split("@")[0] ||
        auth?.currentUser?.email?.split("@")[0] ||
        "User";
      const resolvedEmail =
        userToUse?.email || auth?.currentUser?.email || "";

      const commentData = {
        videoid: videoId,
        videoId: videoId,
        userid: resolvedUserId,
        userId: resolvedUserId,
        commentbody: trimmed,
        comment: trimmed,
        usercommented: resolvedUserName,
        userCommented: resolvedUserName,
        email: resolvedEmail,
        location: location.trim(),
        showLocation: showLocation,
      };

      const res = await axiosInstance.post(
        "/comment/postcomment",
        commentData,
        {
          validateStatus: (status) => status >= 200 && status < 500,
        }
      );

      /* Abusive word or validation failure */
      if (res.status === 400 || res.status === 401) {
        setCommentError(
          res.data?.message ||
            "This comment was blocked because it contains prohibited language."
        );
        return;
      }

      /* Success */
      if (
        res.status >= 200 &&
        res.status < 300 &&
        (res.data?.comment || res.data?.data)
      ) {
        const createdComment: Comment = {
          _id:
            res.data.data?._id ||
            Date.now().toString(),
          videoid: videoId,
          userid: String(resolvedUserId),
          commentbody:
            res.data.data?.commentbody ||
            trimmed,
          usercommented:
            res.data.data?.usercommented ||
            resolvedUserName,
          commentedon:
            res.data.data?.commentedon ||
            new Date().toISOString(),
          location:
            res.data.data?.location ||
            location.trim(),
          showLocation:
            res.data.data?.showLocation ||
            false,
          likedBy: [],
          dislikedBy: [],
          reportedBy: [],
          reportCount: 0,
          reported: false,
        };

        setComments((prev) => [
          createdComment,
          ...prev,
        ]);

        setNewComment("");
        setLocation("");
        setShowLocation(false);
        setShowEmojiPicker(false);
        setCommentError("");
        setCommentSuccess("Comment posted successfully.");

        setTimeout(() => {
          setCommentSuccess("");
        }, 3000);

        return;
      }

      setCommentError(
        res.data?.message || "Unable to post the comment."
      );
    } catch (error) {
      console.error("Comment request error:", error);
      setCommentError(
        "Unable to connect to the server. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /* =========================
     EDIT COMMENT
  ========================= */

  const handleEdit = (comment: Comment) => {
    setEditingCommentId(comment._id);
    setEditText(comment.commentbody);
    clearMessages();
  };

  const handleUpdateComment = async () => {
    if (!editText.trim()) {
      setCommentError(
        "Comment cannot be empty."
      );
      return;
    }

    try {
      const res = await axiosInstance.post(
        `/comment/editcomment/${editingCommentId}`,
        {
          commentbody: editText.trim(),
        },
        {
          validateStatus: (status) =>
            status >= 200 && status < 500,
        }
      );

      /* BAD WORD IN EDITED COMMENT */

      if (res.status === 400) {
        setCommentError(
          res.data?.message ||
            "This comment contains words that are not allowed."
        );

        return;
      }

      if (res.status >= 200 && res.status < 300) {
        setComments((prev) =>
          prev.map((comment) =>
            comment._id === editingCommentId
              ? {
                  ...comment,
                  commentbody:
                    editText.trim(),
                }
              : comment
          )
        );

        setEditingCommentId(null);
        setEditText("");
        setCommentError("");

        setCommentSuccess(
          "Comment updated successfully."
        );

        setTimeout(() => {
          setCommentSuccess("");
        }, 3000);
      }
    } catch (error) {
      console.error(
        "Error updating comment:",
        error
      );

      setCommentError(
        "Unable to update the comment."
      );
    }
  };

  /* =========================
     DELETE COMMENT
  ========================= */

  const handleDelete = async (id: string) => {
    try {
      const res =
        await axiosInstance.delete(
          `/comment/deletecomment/${id}`
        );

      if (res.data.comment) {
        setComments((prev) =>
          prev.filter(
            (comment) =>
              comment._id !== id
          )
        );

        setTranslatedComments((prev) => {
          const updated = { ...prev };
          delete updated[id];
          return updated;
        });
      }
    } catch (error) {
      console.error(
        "Delete error:",
        error
      );
    }
  };

  /* =========================
     LIKE COMMENT
  ========================= */

  const handleLike = async (id: string) => {
    if (!user) return;

    try {
      const res =
        await axiosInstance.post(
          `/comment/like/${id}`,
          {
            userid: user._id,
          }
        );

      setComments((prev) =>
        prev.map((comment) => {
          if (comment._id !== id) {
            return comment;
          }

          let likedBy = [
            ...(comment.likedBy || []),
          ];

          let dislikedBy = [
            ...(comment.dislikedBy || []),
          ];

          if (res.data.liked) {
            if (!likedBy.includes(user._id)) {
              likedBy.push(user._id);
            }

            dislikedBy =
              dislikedBy.filter(
                (userId) =>
                  userId !== user._id
              );
          } else {
            likedBy =
              likedBy.filter(
                (userId) =>
                  userId !== user._id
              );
          }

          return {
            ...comment,
            likedBy,
            dislikedBy,
          };
        })
      );
    } catch (error) {
      console.error(
        "Like error:",
        error
      );
    }
  };

  /* =========================
     DISLIKE COMMENT
  ========================= */

  const handleDislike = async (
    id: string
  ) => {
    if (!user) return;

    try {
      const res =
        await axiosInstance.post(
          `/comment/dislike/${id}`,
          {
            userid: user._id,
          }
        );

      setComments((prev) =>
        prev.map((comment) => {
          if (comment._id !== id) {
            return comment;
          }

          let likedBy = [
            ...(comment.likedBy || []),
          ];

          let dislikedBy = [
            ...(comment.dislikedBy || []),
          ];

          if (res.data.disliked) {
            if (
              !dislikedBy.includes(
                user._id
              )
            ) {
              dislikedBy.push(user._id);
            }

            likedBy =
              likedBy.filter(
                (userId) =>
                  userId !== user._id
              );
          } else {
            dislikedBy =
              dislikedBy.filter(
                (userId) =>
                  userId !== user._id
              );
          }

          return {
            ...comment,
            likedBy,
            dislikedBy,
          };
        })
      );
    } catch (error) {
      console.error(
        "Dislike error:",
        error
      );
    }
  };

  /* =========================
     REPORT COMMENT
  ========================= */

  const handleReport = async (
    id: string
  ) => {
    if (!user) return;

    try {
      const res =
        await axiosInstance.post(
          `/comment/report/${id}`,
          {
            userid: user._id,
          }
        );

      setComments((prev) =>
        prev.map((comment) =>
          comment._id === id
            ? {
                ...comment,
                reported: true,
                reportCount:
                  res.data.reportCount,
                reportedBy: [
                  ...(comment.reportedBy ||
                    []),
                  user._id,
                ],
              }
            : comment
        )
      );

      setCommentSuccess(
        "Comment reported and flagged for review."
      );

      setTimeout(() => {
        setCommentSuccess("");
      }, 3000);
    } catch (error: any) {
      setCommentError(
        error?.response?.data
          ?.message ||
          "Unable to report comment."
      );
    }
  };

  /* =========================
     TRANSLATION
  ========================= */

  const handleTranslate = async (
    commentId: string,
    text: string
  ) => {
    const language =
      translationLanguages[
        commentId
      ];

    if (!language) return;

    setTranslatingComment(
      commentId
    );

    try {
      const url =
        "https://translate.googleapis.com/translate_a/single" +
        `?client=gtx` +
        `&sl=auto` +
        `&tl=${language}` +
        `&dt=t` +
        `&q=${encodeURIComponent(
          text
        )}`;

      const response =
        await fetch(url);

      if (!response.ok) {
        throw new Error(
          "Translation failed"
        );
      }

      const data =
        await response.json();

      if (data && data[0]) {
        const translatedText =
          data[0]
            .map(
              (item: any) =>
                item[0]
            )
            .join("");

        setTranslatedComments(
          (prev) => ({
            ...prev,
            [commentId]:
              translatedText,
          })
        );
      }
    } catch (error) {
      console.error(
        "Translation error:",
        error
      );

      setTranslatedComments(
        (prev) => ({
          ...prev,
          [commentId]:
            "Translation failed. Please try again.",
        })
      );
    } finally {
      setTranslatingComment(null);
    }
  };

  /* =========================
     LOADING
  ========================= */

  if (loading) {
    return (
      <div>
        Loading comments...
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* COMMENT COUNT */}

      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
        {comments.length} Comments
      </h2>

      {/* =========================
          ADD COMMENT
      ========================= */}

      {user ? (
        <div className="flex gap-4">

          <Avatar className="w-10 h-10">
            <AvatarImage
              src={user.image || ""}
            />

            <AvatarFallback>
              {user.name?.[0] ||
                user.username?.[0] ||
                "U"}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-3">

            {/* COMMENT INPUT */}

            <div className="relative">

              <Textarea
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => {
                  setNewComment(
                    e.target.value
                  );

                  clearMessages();
                }}
                className="min-h-[80px] resize-none border-0 border-b-2 rounded-none focus-visible:ring-0 pr-12 bg-transparent text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 border-gray-300 dark:border-gray-700"
              />

              {/* EMOJI BUTTON */}

              <button
                type="button"
                onClick={() =>
                  setShowEmojiPicker(
                    !showEmojiPicker
                  )
                }
                className="absolute right-2 bottom-3 text-xl hover:scale-110 transition-transform"
              >
                😊
              </button>

              {/* EMOJI PICKER */}

              {showEmojiPicker && (
                <div className="absolute right-0 bottom-12 z-50">
                  <EmojiPicker
                    onEmojiClick={(
                      emojiData
                    ) => {
                      setNewComment(
                        (prev) =>
                          prev +
                          emojiData.emoji
                      );

                      clearMessages();
                    }}
                    width={320}
                    height={400}
                  />
                </div>
              )}

            </div>

            {/* =========================
                BAD WORD WARNING
            ========================= */}

            {commentError && (
              <div className="rounded-lg border-2 border-red-500/80 bg-red-50 dark:bg-red-950/40 p-4 text-red-700 dark:text-red-300">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <p className="font-semibold">
                      {commentError.toLowerCase().includes("prohibited") ||
                      commentError.toLowerCase().includes("blocked") ||
                      commentError.toLowerCase().includes("abusive") ||
                      commentError.toLowerCase().includes("spam")
                        ? "Comment Blocked"
                        : "Comment Notice"}
                    </p>
                    <p className="text-sm mt-1">{commentError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* =========================
                SUCCESS
            ========================= */}

            {commentSuccess && (
              <div className="rounded-lg border-2 border-green-400 bg-green-50 p-4 text-green-700">

                <div className="flex items-center gap-3">

                  <span className="text-xl">
                    ✅
                  </span>

                  <p className="font-medium">
                    {commentSuccess}
                  </p>

                </div>

              </div>
            )}

            {/* LOCATION */}

            <div className="flex flex-wrap items-center gap-3">

              <input
                type="text"
                placeholder="Location (optional)"
                value={location}
                onChange={(e) =>
                  setLocation(
                    e.target.value
                  )
                }
                className="border rounded-md px-3 py-2 text-sm bg-white dark:bg-[#272727] text-gray-900 dark:text-white border-gray-300 dark:border-gray-700 placeholder:text-gray-500 dark:placeholder:text-gray-400"
              />

              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">

                <input
                  type="checkbox"
                  checked={
                    showLocation
                  }
                  onChange={(e) =>
                    setShowLocation(
                      e.target.checked
                    )
                  }
                />

                Show my location

              </label>

            </div>

            {/* BUTTONS */}

            <div className="flex gap-2 justify-end">

              <Button
                variant="ghost"
                className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#272727]"
                onClick={() => {
                  setNewComment("");
                  setLocation("");
                  setShowLocation(false);
                  setShowEmojiPicker(false);
                  clearMessages();
                }}
              >
                Cancel
              </Button>

              <Button
                className="bg-red-600 hover:bg-red-700 text-white font-medium"
                onClick={
                  handleSubmitComment
                }
                disabled={
                  !newComment.trim() ||
                  isSubmitting
                }
              >
                {isSubmitting
                  ? "Checking..."
                  : "Comment"}
              </Button>

            </div>

          </div>
        </div>
      ) : (
        <div className="flex gap-4 items-center p-3 rounded-lg border border-dashed border-gray-300 dark:border-[#383838] bg-gray-50/50 dark:bg-[#1f1f1f]/50 text-sm text-gray-600 dark:text-gray-400">
          <Avatar className="w-10 h-10 opacity-60">
            <AvatarFallback className="bg-gray-200 dark:bg-[#272727] text-gray-500">?</AvatarFallback>
          </Avatar>
          <span>Please sign in to comment.</span>
        </div>
      )}

      {/* =========================
          COMMENTS
      ========================= */}

      <div className="space-y-6">

        {comments.length === 0 ? (
          <p className="text-sm text-gray-500 italic">
            No comments yet. Be the
            first to comment!
          </p>
        ) : (
          comments.map((comment) => {

            const likes =
              comment.likedBy?.length ||
              0;

            const dislikes =
              comment.dislikedBy
                ?.length || 0;

            const userLiked =
              !!user &&
              (
                comment.likedBy || []
              ).includes(user._id);

            const userDisliked =
              !!user &&
              (
                comment.dislikedBy || []
              ).includes(user._id);

            const translationOpen =
              translationMenu ===
              comment._id;

            return (
              <div
                key={comment._id}
                className="flex gap-4"
              >

                {/* AVATAR */}

                <Avatar className="w-10 h-10">

                  <AvatarImage
                    src="/placeholder.svg"
                  />

                  <AvatarFallback>
                    {comment.usercommented?.[0] ||
                      "U"}
                  </AvatarFallback>

                </Avatar>

                <div className="flex-1">

                  {/* USER DETAILS */}

                  <div className="flex flex-wrap items-center gap-2 mb-1">

                    <span className="font-semibold text-sm text-gray-900 dark:text-white">
                      {comment.usercommented}
                    </span>

                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDistanceToNow(
                        new Date(
                          comment.commentedon
                        )
                      )}{" "}
                      ago
                    </span>

                    {comment.showLocation &&
                      comment.location && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          •{" "}
                          {comment.location}
                        </span>
                      )}

                  </div>

                  {/* EDIT */}

                  {editingCommentId ===
                  comment._id ? (

                    <div className="space-y-2">

                      <Textarea
                        value={editText}
                        onChange={(e) => {
                          setEditText(
                            e.target.value
                          );
                          clearMessages();
                        }}
                      />

                      <div className="flex gap-2 justify-end">

                        <Button
                          onClick={
                            handleUpdateComment
                          }
                          disabled={
                            !editText.trim()
                          }
                        >
                          Save
                        </Button>

                        <Button
                          variant="ghost"
                          onClick={() => {
                            setEditingCommentId(
                              null
                            );
                            setEditText("");
                            clearMessages();
                          }}
                        >
                          Cancel
                        </Button>

                      </div>

                    </div>

                  ) : (

                    <>

                      {/* COMMENT TEXT */}

                      <p className="text-sm mb-2 break-words text-gray-800 dark:text-gray-200 leading-relaxed">
                        {comment.commentbody}
                      </p>

                      {/* TRANSLATED TEXT */}

                      {translatedComments[
                        comment._id
                      ] && (
                        <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#202020] p-3 mb-3 text-gray-800 dark:text-gray-200">

                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                            Translation
                          </p>

                          <p className="text-sm text-gray-800 dark:text-gray-200">
                            {
                              translatedComments[
                                comment._id
                              ]
                            }
                          </p>

                        </div>
                      )}

                      {/* ACTIONS */}

                      <div className="flex flex-wrap items-center gap-2 text-sm">

                        <button
                          onClick={() =>
                            handleLike(
                              comment._id
                            )
                          }
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            userLiked
                              ? "bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400"
                              : "bg-gray-100 dark:bg-[#272727] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#383838]"
                          }`}
                        >
                          👍 {likes}
                        </button>

                        <button
                          onClick={() =>
                            handleDislike(
                              comment._id
                            )
                          }
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            userDisliked
                              ? "bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400"
                              : "bg-gray-100 dark:bg-[#272727] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#383838]"
                          }`}
                        >
                          👎 {dislikes}
                        </button>

                        <button
                          onClick={() => {
                            setReplyingToId(
                              replyingToId === comment._id ? null : comment._id
                            );
                            setReplyText("");
                          }}
                          className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-[#272727] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#383838] transition-colors"
                        >
                          Reply
                        </button>

                        <button
                          onClick={() =>
                            setTranslationMenu(
                              translationOpen
                                ? null
                                : comment._id
                            )
                          }
                          className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-[#272727] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#383838] transition-colors"
                        >
                          🌐 Translate
                        </button>

                        <button
                          onClick={() =>
                            handleReport(
                              comment._id
                            )
                          }
                          className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-[#272727] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#383838] transition-colors"
                        >
                          🚩 Report
                        </button>

                        {comment.reported && (
                          <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                            Flagged for review
                          </span>
                        )}

                        {comment.userid ===
                          user?._id && (
                          <>
                            <button
                              onClick={() =>
                                handleEdit(
                                  comment
                                )
                              }
                              className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-[#272727] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#383838] transition-colors"
                            >
                              Edit
                            </button>

                            <button
                              onClick={() =>
                                handleDelete(
                                  comment._id
                                )
                              }
                              className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-[#272727] text-red-600 dark:text-red-400 hover:bg-gray-200 dark:hover:bg-[#383838] transition-colors"
                            >
                              Delete
                            </button>
                          </>
                        )}

                      </div>

                      {/* INLINE REPLY BOX */}

                      {replyingToId === comment._id && (
                        <div className="mt-3 flex gap-3 items-start pl-2 border-l-2 border-red-500">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback>{user?.name?.[0] || "U"}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 space-y-2">
                            <Textarea
                              placeholder={`Reply to ${comment.usercommented}...`}
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              className="min-h-[60px] text-xs resize-none border-b-2 rounded-none focus-visible:ring-0 bg-transparent text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 border-gray-300 dark:border-gray-700"
                            />
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#272727]"
                                onClick={() => {
                                  setReplyingToId(null);
                                  setReplyText("");
                                }}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white font-medium"
                                disabled={!replyText.trim() || isSubmitting}
                                onClick={async () => {
                                  if (!user) {
                                    setCommentError("Please sign in to comment.");
                                    return;
                                  }
                                  const trimmedReply = `@${comment.usercommented} ${replyText.trim()}`;
                                  setIsSubmitting(true);
                                  try {
                                    const res = await axiosInstance.post(
                                      "/comment/postcomment",
                                      {
                                        videoid: videoId,
                                        videoId: videoId,
                                        userid: user._id || user.uid,
                                        userId: user._id || user.uid,
                                        commentbody: trimmedReply,
                                        comment: trimmedReply,
                                        usercommented: user.name || user.displayName || "User",
                                        userCommented: user.name || user.displayName || "User",
                                      }
                                    );
                                    if (res.data?.data) {
                                      setComments((prev) => [res.data.data, ...prev]);
                                      setReplyingToId(null);
                                      setReplyText("");
                                      setCommentSuccess("Reply posted successfully.");
                                      setTimeout(() => setCommentSuccess(""), 3000);
                                    }
                                  } catch (err: any) {
                                    setCommentError("Unable to post reply.");
                                  } finally {
                                    setIsSubmitting(false);
                                  }
                                }}
                              >
                                Reply
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TRANSLATION MENU */}

                      {translationOpen && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">

                          <select
                            value={
                              translationLanguages[
                                comment._id
                              ] || ""
                            }
                            onChange={(e) =>
                              setTranslationLanguages(
                                (prev) => ({
                                  ...prev,
                                  [comment._id]:
                                    e.target.value,
                                })
                              )
                            }
                            className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#272727] text-gray-900 dark:text-white rounded-md px-3 py-2 text-sm"
                          >

                            <option value="">
                              Select language
                            </option>

                            <option value="en">
                              English
                            </option>

                            <option value="te">
                              Telugu
                            </option>

                            <option value="hi">
                              Hindi
                            </option>

                            <option value="ta">
                              Tamil
                            </option>

                            <option value="kn">
                              Kannada
                            </option>

                            <option value="ml">
                              Malayalam
                            </option>

                            <option value="mr">
                              Marathi
                            </option>

                            <option value="bn">
                              Bengali
                            </option>

                            <option value="gu">
                              Gujarati
                            </option>

                            <option value="es">
                              Spanish
                            </option>

                            <option value="fr">
                              French
                            </option>

                            <option value="de">
                              German
                            </option>

                            <option value="it">
                              Italian
                            </option>

                            <option value="pt">
                              Portuguese
                            </option>

                            <option value="ja">
                              Japanese
                            </option>

                            <option value="ko">
                              Korean
                            </option>

                            <option value="zh-CN">
                              Chinese
                            </option>

                            <option value="ar">
                              Arabic
                            </option>

                            <option value="ru">
                              Russian
                            </option>

                          </select>

                          <Button
                            size="sm"
                            disabled={
                              !translationLanguages[
                                comment._id
                              ] ||
                              translatingComment ===
                                comment._id
                            }
                            onClick={() =>
                              handleTranslate(
                                comment._id,
                                comment.commentbody
                              )
                            }
                          >
                            {translatingComment ===
                            comment._id
                              ? "Translating..."
                              : "Translate"}
                          </Button>

                        </div>
                      )}

                    </>
                  )}

                </div>

              </div>
            );
          })
        )}

      </div>

    </div>
  );
};

export default Comments;