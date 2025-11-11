import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "./postview.css";
import { API_BASE_URL } from "../config";
import { useAuth } from "../contexts/AuthContext";
import {
	createCodeLowlight,
	getCodeLanguageLabel,
	normalizeCodeLanguage,
} from "../utils/codeHighlight";

const FALLBACK_AVATAR =
	"https://api.dicebear.com/7.x/initials/svg?seed=Reader";

const formatDate = (value) => {
	if (!value) return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return null;
	}

	return date.toLocaleDateString(undefined, {
		month: "long",
		day: "numeric",
		year: "numeric",
	});
};

const formatRelativeTime = (value) => {
	if (!value) return "";
	const target = new Date(value);
	if (Number.isNaN(target.getTime())) {
		return "";
	}

	const diff = Date.now() - target.getTime();
	const minute = 60 * 1000;
	const hour = 60 * minute;
	const day = 24 * hour;
	const month = 30 * day;
	const year = 365 * day;

	if (diff < minute) return "just now";
	if (diff < hour) {
		const count = Math.floor(diff / minute);
		return `${count} minute${count === 1 ? "" : "s"} ago`;
	}
	if (diff < day) {
		const count = Math.floor(diff / hour);
		return `${count} hour${count === 1 ? "" : "s"} ago`;
	}
	if (diff < month) {
		const count = Math.floor(diff / day);
		return `${count} day${count === 1 ? "" : "s"} ago`;
	}
	if (diff < year) {
		const count = Math.floor(diff / month);
		return `${count} month${count === 1 ? "" : "s"} ago`;
	}
	const count = Math.floor(diff / year);
	return `${count} year${count === 1 ? "" : "s"} ago`;
};

const resolveAvatar = (author) => {
	if (!author) return FALLBACK_AVATAR;
	const candidate = [author.avatar, author.photo, author.picture].find(
		(value) => typeof value === "string" && value.trim().length > 0
	);
	if (candidate) {
		return candidate;
	}
	const seed = author.name || author.username || "Reader";
	return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
		seed
	)}`;
};

const renderLowlightNodes = (nodes = [], parentKey = "hl") =>
	nodes.map((node, index) => {
		if (!node) {
			return null;
		}
		if (node.type === "text") {
			return node.value || "";
		}
		if (node.type !== "element") {
			return null;
		}

		const Tag = node.tagName || "span";
		const key = `${parentKey}-${index}`;
		const props = {};

		if (node.properties) {
			Object.entries(node.properties).forEach(([prop, value]) => {
				if (prop === "className") {
					if (Array.isArray(value)) {
						props.className = value.join(" ");
					} else if (typeof value === "string") {
						props.className = value;
					}
				} else if (value !== undefined) {
					props[prop] = value;
				}
			});
		}

		return (
			<Tag key={key} {...props}>
				{renderLowlightNodes(node.children || [], key)}
			</Tag>
		);
	});

const applyMarkups = (text = "", markups = []) => {
	if (!text || !Array.isArray(markups) || markups.length === 0) {
		return text;
	}

	const sorted = [...markups].sort((a, b) => {
		const startA = typeof a.start === "number" ? a.start : 0;
		const startB = typeof b.start === "number" ? b.start : 0;
		return startA - startB;
	});

	const fragments = [];
	let cursor = 0;

	sorted.forEach((markup, index) => {
		const start = Math.max(0, Number(markup.start) || 0);
		const end = Math.min(text.length, Number(markup.end) || text.length);

		if (start > cursor) {
			fragments.push(text.slice(cursor, start));
		}

		const innerText = text.slice(start, end);
		const key = `${start}-${end}-${index}`;
		const type = (markup.type || "").toString().toUpperCase();

		let element = innerText;

		switch (type) {
			case "BOLD":
				element = <strong key={key}>{innerText}</strong>;
				break;
			case "ITALIC":
				element = <em key={key}>{innerText}</em>;
				break;
			case "UNDERLINE":
				element = <u key={key}>{innerText}</u>;
				break;
			case "HIGHLIGHT":
				element = <mark key={key}>{innerText}</mark>;
				break;
			case "CODE":
				element = <code key={key}>{innerText}</code>;
				break;
			case "LINK":
				element = (
					<a
						key={key}
						href={markup.href || markup.url || "#"}
						target="_blank"
						rel="noopener noreferrer"
						className="post-inline-link"
					>
						{innerText}
					</a>
				);
				break;
			default:
				element = innerText;
		}

		fragments.push(element);
		cursor = end;
	});

	if (cursor < text.length) {
		fragments.push(text.slice(cursor));
	}

	return fragments;
};

const renderListItems = (items = []) => {
	if (!Array.isArray(items) || items.length === 0) {
		return null;
	}

	return items.map((item, index) => (
		<li key={item?.id || index}>{applyMarkups(item?.text || "", item?.markups)}</li>
	));
};

const renderBlock = (block, index, renderCodeBlock) => {
	if (!block) return null;
	const key = block.id || `${block.type}-${index}`;
	const type = (block.type || "").toString().toUpperCase();

	switch (type) {
		case "P":
			return (
				<p key={key} className="post-paragraph">
					{applyMarkups(block.text || "", block.markups)}
				</p>
			);

		case "H1":
			return (
				<h1 key={key} className="post-heading-1">
					{block.text}
				</h1>
			);

		case "H2":
			return (
				<h2 key={key} className="post-heading-2">
					{block.text}
				</h2>
			);

		case "H3":
			return (
				<h3 key={key} className="post-heading-3">
					{block.text}
				</h3>
			);

		case "BLOCKQUOTE":
		case "BQ":
			return (
				<blockquote key={key} className="post-blockquote">
					{applyMarkups(block.text || "", block.markups)}
				</blockquote>
			);

		case "UL":
			return (
				<ul key={key} className="post-list">
					{renderListItems(block.items || block.children)}
				</ul>
			);

		case "OL":
			return (
				<ol key={key} className="post-list ordered">
					{renderListItems(block.items || block.children)}
				</ol>
			);

		case "DIVIDER":
			return <hr key={key} className="post-divider" />;

		case "CODE":
			return typeof renderCodeBlock === "function"
				? renderCodeBlock(block, key)
				: (
					<pre key={key} className="post-code-block">
						<code>{block.codeBlock || block.text}</code>
					</pre>
				);

		case "IMG": {
			const image = block.image || {};
			const source =
				image.displayUrl ||
				image.url ||
				image.originalUrl ||
				image.secureUrl ||
				image.thumbnailUrl;

			if (!source) {
				return null;
			}

			const width = Number(image.width) || undefined;
			const height = Number(image.height) || undefined;

			return (
				<figure key={key} className="post-image-container">
					<img
						src={source}
						alt={image.alt || ""}
						className="post-image"
						loading="lazy"
						width={width}
						height={height}
					/>
					{image.caption && (
						<figcaption className="post-image-caption">
							{image.caption}
						</figcaption>
					)}
				</figure>
			);
		}

		case "VIDEO": {
			const video = block.video || {};
			const url = video.url || video.embedUrl;
			if (!url) {
				return null;
			}

			const platform = (video.platform || "").toString().toUpperCase();
			if (platform === "YOUTUBE" || /youtube\.com|youtu\.be/.test(url)) {
				const embedUrl = url.includes("embed")
					? url
					: url.replace("watch?v=", "embed/");
				return (
					<div key={key} className="post-video">
						<iframe
							src={embedUrl}
							title={video.caption || "Embedded video"}
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
							allowFullScreen
						/>
						{video.caption && (
							<p className="post-video-title">{video.caption}</p>
						)}
					</div>
				);
			}

			return (
				<div key={key} className="post-video">
					<video
						controls
						width={video.width || "100%"}
						height={video.height || undefined}
						poster={video.thumbnail}
					>
						<source src={url} />
						Your browser does not support embedded video.
					</video>
					{video.caption && (
						<p className="post-video-title">{video.caption}</p>
					)}
				</div>
			);
		}

		default:
			return null;
	}
};

const CommentItem = ({
	comment,
	currentUserId,
	replyTargetId,
	replyContent,
	onChangeReplyContent,
	onStartReply,
	onCancelReply,
	onSubmitReply,
	replyError,
	replySubmitting,
	onDelete,
}) => {
	const author = comment?.author;
	const replies = Array.isArray(comment?.replies) ? comment.replies : [];
	const commentId = comment?.id || comment?._id;
	const currentUserIdString =
		typeof currentUserId === "string"
			? currentUserId
			: currentUserId?.toString?.() || null;
	const authorIdCandidate =
		typeof author?._id !== "undefined" && author?._id !== null
			? author._id
			: author?.id;
	const authorIdString =
		typeof authorIdCandidate === "string"
			? authorIdCandidate
			: authorIdCandidate?.toString?.() || null;
	const isReplyTarget = replyTargetId === commentId;
	const canDelete = Boolean(currentUserIdString && authorIdString && currentUserIdString === authorIdString);

	return (
		<li className="comment-item" key={commentId}>
			<div className="comment-header">
				<img
					src={resolveAvatar(author)}
					alt={author?.name || author?.username || "Reader"}
					className="comment-avatar"
				/>
				<div className="comment-author">
					<span className="comment-author-name">
						{author?.name || author?.username || "Reader"}
					</span>
					<span className="comment-timestamp">
						{formatRelativeTime(comment?.createdAt)}
					</span>
				</div>
			</div>

			{comment?.content && (
				<p className="comment-body">{comment.content}</p>
			)}

			<div className="comment-actions-row">
				<button
					type="button"
					className="comment-action-btn"
					onClick={() => onStartReply(comment)}
				>
					Reply
				</button>
				{canDelete ? (
					<button
						type="button"
						className="comment-action-btn comment-action-btn--danger"
						onClick={() => onDelete(comment)}
					>
						Delete
					</button>
				) : null}
			</div>

			{isReplyTarget && (
				<form className="comment-reply-composer" onSubmit={(event) => onSubmitReply(event, comment)}>
					<textarea
						value={replyContent}
						onChange={(event) => onChangeReplyContent(event.target.value)}
						placeholder="Write a reply"
						rows={3}
						disabled={replySubmitting}
					/>
					{replyError ? <div className="comment-error">{replyError}</div> : null}
					<div className="comment-reply-actions">
						<button
							type="button"
							className="comment-action-btn"
							onClick={onCancelReply}
							disabled={replySubmitting}
						>
							Cancel
						</button>
						<button
							type="submit"
							className="comment-action-btn comment-action-btn--primary"
							disabled={replySubmitting || !replyContent.trim()}
						>
							{replySubmitting ? "Replying…" : "Reply"}
						</button>
					</div>
				</form>
			)}

			{replies.length > 0 && (
				<ul className="comment-replies">
					{replies.map((reply) => (
						<CommentItem
							key={reply?.id || reply?._id}
							comment={reply}
							currentUserId={currentUserId}
							replyTargetId={replyTargetId}
							replyContent={replyContent}
							onChangeReplyContent={onChangeReplyContent}
							onStartReply={onStartReply}
							onCancelReply={onCancelReply}
							onSubmitReply={onSubmitReply}
							replyError={replyError}
							replySubmitting={replySubmitting}
							onDelete={onDelete}
						/>
					))}
				</ul>
			)}
		</li>
	);
};

const CommentComposer = ({
	canRespond,
	content,
	disabled,
	error,
	onChange,
	onSubmit,
}) => {
	if (!canRespond) {
		return (
			<div className="comment-disabled">Responses are turned off for this story.</div>
		);
	}

	return (
		<form className="comment-composer" onSubmit={onSubmit}>
			<textarea
				placeholder="Share your thoughts"
				value={content}
				onChange={(event) => onChange(event.target.value)}
				disabled={disabled}
				rows={4}
			/>
			{error && <div className="comment-error">{error}</div>}
			<div className="comment-actions">
				<button
					type="submit"
					className="comment-submit"
					disabled={disabled || !content.trim()}
				>
					Publish response
				</button>
			</div>
		</form>
	);
};

const PostMeta = ({
	author,
	publishedAt,
	readingTime,
	clapCount,
	responseCount,
	isAuthenticated,
	onClap,
	clapping,
}) => {
	const dateLabel = formatDate(publishedAt);
	const minutes = readingTime ? Math.max(1, Math.round(readingTime)) : null;
	const readLabel = minutes ? `${minutes} min read` : null;
	const authorName = author?.name || author?.username || "Unknown";
	const profilePath = author?.username
		? `/u/${encodeURIComponent(author.username)}`
		: "/profile";

	return (
		<div className="post-meta">
			<div className="post-meta-left">
				<img
					src={resolveAvatar(author)}
					alt={authorName}
					className="post-author-avatar"
				/>
				<div className="post-author-info">
					<div className="post-author-row">
						<span className="post-author-name">{authorName}</span>
						<Link className="post-author-profile" to={profilePath}>
							View profile
						</Link>
					</div>
					<div className="post-author-meta">
						{readLabel && <span>{readLabel}</span>}
						{readLabel && dateLabel && <span className="separator">•</span>}
						{dateLabel && <span>{dateLabel}</span>}
					</div>
				</div>
			</div>

			<div className="post-meta-right">
				<button
					type="button"
					className="post-meta-btn"
					onClick={onClap}
					disabled={!isAuthenticated || clapping}
					title={
						isAuthenticated
							? "Clap for this story"
							: "Sign in to clap for stories"
					}
				>
					👏 {clapCount ?? 0}
				</button>
				<span className="post-meta-response-count">
					💬 {responseCount ?? 0}
				</span>
			</div>
		</div>
	);
};

const PostTags = ({ tags }) => {
	if (!Array.isArray(tags) || tags.length === 0) {
		return null;
	}

	return (
		<ul className="post-tags">
			{tags.map((tag) => (
				<li key={tag}>{tag}</li>
			))}
		</ul>
	);
};

export default function PostView() {
	const { id } = useParams();
	const { token, user } = useAuth();

	const [post, setPost] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	const [clapCount, setClapCount] = useState(0);
	const [clapping, setClapping] = useState(false);

	const [comments, setComments] = useState([]);
	const [commentsLoading, setCommentsLoading] = useState(false);
	const [commentContent, setCommentContent] = useState("");
	const [commentError, setCommentError] = useState(null);
	const [commentSubmitting, setCommentSubmitting] = useState(false);
	const [replyTargetId, setReplyTargetId] = useState(null);
	const [replyContent, setReplyContent] = useState("");
	const [replyError, setReplyError] = useState(null);
	const [replySubmitting, setReplySubmitting] = useState(false);

	const codeLowlight = useMemo(() => createCodeLowlight(), []);

	const renderCodeBlock = useCallback(
		(block, key) => {
			const rawContent =
				typeof block?.codeBlock === "string"
					? block.codeBlock
					: typeof block?.text === "string"
						? block.text
						: "";
			const normalizedLanguage = normalizeCodeLanguage(
				block?.codeLanguage || block?.language
			);

			let highlightTree;
			let resolvedLanguage = normalizedLanguage || "plaintext";

			try {
				if (rawContent) {
					if (normalizedLanguage) {
						highlightTree = codeLowlight.highlight(
							normalizedLanguage,
							rawContent
						);
					} else if (typeof codeLowlight.highlightAuto === "function") {
						highlightTree = codeLowlight.highlightAuto(rawContent);
						resolvedLanguage = normalizeCodeLanguage(
							highlightTree?.data?.language
						) || resolvedLanguage;
					} else {
						highlightTree = codeLowlight.highlight("plaintext", rawContent);
						resolvedLanguage = "plaintext";
					}
				} else {
					highlightTree = { children: [] };
					resolvedLanguage = normalizedLanguage || "plaintext";
				}
			} catch (error) {
				if (typeof codeLowlight.highlightAuto === "function") {
					highlightTree = codeLowlight.highlightAuto(rawContent || "");
					resolvedLanguage =
						normalizeCodeLanguage(highlightTree?.data?.language) ||
						"plaintext";
				} else {
					highlightTree = codeLowlight.highlight("plaintext", rawContent || "");
					resolvedLanguage = "plaintext";
				}
			}

			let highlightedNodes = renderLowlightNodes(
				highlightTree?.children || [],
				`code-${key}`
			);

			if (!highlightedNodes || highlightedNodes.length === 0) {
				highlightedNodes = [rawContent];
			}

			const languageLabel = getCodeLanguageLabel(resolvedLanguage);

			return (
				<pre key={key} className="post-code-block" data-language={languageLabel}>
					<code className="hljs">{highlightedNodes}</code>
				</pre>
			);
		},
		[codeLowlight]
	);

	const isAuthenticated = Boolean(token && user);
	const currentUserId = useMemo(() => {
		const candidate = user?._id || user?.id || null;
		if (!candidate) {
			return null;
		}
		return typeof candidate === "string" ? candidate : candidate.toString?.() || null;
	}, [user]);
	const postId = post?.id || post?._id || null;

	const coverImageSrc = useMemo(() => {
		if (!post) return null;
		const meta = post.coverImageMeta || {};
		return (
			meta.displayUrl ||
			meta.secureUrl ||
			meta.originalUrl ||
			post.coverImage ||
			null
		);
	}, [post]);

	const fetchPost = useCallback(async () => {
		if (!id) {
			setError("Missing post identifier");
			setLoading(false);
			return;
		}

		setLoading(true);
		setError(null);

		try {
			const response = await fetch(`${API_BASE_URL}/api/posts/${id}`);
			if (!response.ok) {
				throw new Error("Unable to load story");
			}

			const payload = await response.json();
			setPost(payload);
			setClapCount(payload?.clapCount ?? 0);
		} catch (fetchError) {
			setError(fetchError.message || "Failed to load story");
		} finally {
			setLoading(false);
		}
	}, [id]);

	const fetchComments = useCallback(async () => {
		if (!postId) {
			return;
		}

		setCommentsLoading(true);
		try {
			const response = await fetch(
				`${API_BASE_URL}/api/comments?postId=${postId}`
			);

			if (!response.ok) {
				throw new Error("Unable to load responses");
			}

			const payload = await response.json();
			setComments(Array.isArray(payload?.items) ? payload.items : []);
		} catch (commentError) {
			console.warn(commentError);
		} finally {
			setCommentsLoading(false);
		}
	}, [postId]);

	useEffect(() => {
		fetchPost();
	}, [fetchPost]);

	useEffect(() => {
		fetchComments();
	}, [fetchComments]);

	const handleClap = useCallback(async () => {
		if (!isAuthenticated) {
			return;
		}

		if (!post || clapping) {
			return;
		}

		setClapping(true);
		setError(null);

		const identifier = post.slug || post.id || post._id || id;

		try {
			const response = await fetch(
				`${API_BASE_URL}/api/posts/${identifier}/clap`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
				}
			);

			if (!response.ok) {
				throw new Error("Unable to clap right now");
			}

			const payload = await response.json();
			setClapCount(payload?.clapCount ?? clapCount + 1);
		} catch (clapError) {
			setError(clapError.message || "Failed to clap story");
		} finally {
			setClapping(false);
		}
	}, [clapping, clapCount, id, isAuthenticated, post, token]);

	const handleSubmitComment = useCallback(
		async (event) => {
			event.preventDefault();

			if (!isAuthenticated) {
				setCommentError("Sign in to publish a response");
				return;
			}

			if (!postId) {
				setCommentError("Missing post reference");
				return;
			}

			if (!commentContent.trim()) {
				setCommentError("Write something before publishing");
				return;
			}

			setCommentError(null);
			setCommentSubmitting(true);

			try {
				const response = await fetch(`${API_BASE_URL}/api/comments`, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						postId,
						content: commentContent.trim(),
					}),
				});

				if (!response.ok) {
					const payload = await response.json().catch(() => ({}));
					throw new Error(payload?.error || "Unable to publish response");
				}

				setCommentContent("");
				setPost((previous) =>
					previous
						? { ...previous, responseCount: (previous.responseCount || 0) + 1 }
						: previous
				);
				await fetchComments();
			} catch (submitError) {
				setCommentError(submitError.message || "Failed to publish response");
			} finally {
				setCommentSubmitting(false);
			}
		},
		[commentContent, fetchComments, isAuthenticated, postId, token]
	);

	const handleStartReply = useCallback(
		(targetComment) => {
			if (!targetComment?.id) {
				return;
			}

			if (!isAuthenticated) {
				setCommentError("Sign in to publish a response");
				return;
			}

			const mentionPrefill = targetComment?.author?.username
				? `@${targetComment.author.username} `
				: "";

			setCommentError(null);
			setReplyError(null);
			setReplyTargetId((previousTarget) => {
				if (previousTarget !== targetComment.id) {
					setReplyContent(mentionPrefill);
				}
				return targetComment.id;
			});
		},
		[isAuthenticated]
	);

	const handleCancelReply = useCallback(() => {
		setReplyTargetId(null);
		setReplyContent("");
		setReplyError(null);
	}, []);

	const handleSubmitReply = useCallback(
		async (event, targetComment) => {
			if (event) {
				event.preventDefault();
			}

			if (!isAuthenticated || !token) {
				setReplyError("Sign in to publish a response");
				return;
			}

			if (!postId) {
				setReplyError("Missing story reference");
				return;
			}

			const parentId = targetComment?.id || replyTargetId;
			if (!parentId) {
				setReplyError("Unable to determine reply target");
				return;
			}

			if (!replyContent.trim()) {
				setReplyError("Write something before replying");
				return;
			}

			setReplyError(null);
			setReplySubmitting(true);

			try {
				const response = await fetch(`${API_BASE_URL}/api/comments`, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						postId,
						content: replyContent.trim(),
						parentCommentId: parentId,
					}),
				});

				if (!response.ok) {
					const payload = await response.json().catch(() => ({}));
					throw new Error(payload?.error || "Unable to publish reply");
				}

				setReplyContent("");
				setReplyTargetId(null);
				setPost((previous) =>
					previous
						? { ...previous, responseCount: (previous.responseCount || 0) + 1 }
						: previous
				);
				await fetchComments();
			} catch (submitError) {
				console.error(submitError);
				setReplyError(submitError.message || "Failed to publish reply");
			} finally {
				setReplySubmitting(false);
			}
		},
			[fetchComments, isAuthenticated, postId, replyContent, replyTargetId, token]
	);

	const handleDeleteComment = useCallback(
		async (targetComment) => {
			if (!targetComment?.id) {
				return;
			}

			if (!isAuthenticated || !token) {
				setCommentError("Sign in to manage your responses");
				return;
			}

			const confirmed = window.confirm("Delete this response?");
			if (!confirmed) {
				return;
			}

			try {
				setCommentError(null);
				const response = await fetch(`${API_BASE_URL}/api/comments/${targetComment.id}`, {
					method: "DELETE",
					headers: {
						Authorization: `Bearer ${token}`,
					},
				});

				const payload = await response.json().catch(() => ({}));

				if (!response.ok) {
					throw new Error(payload?.error || "Unable to delete response");
				}

				setPost((previous) => {
					if (!previous) {
						return previous;
					}
					const nextCount = Math.max(0, (previous.responseCount || 1) - 1);
					return { ...previous, responseCount: nextCount };
				});

				if (replyTargetId === targetComment.id) {
					handleCancelReply();
				}

				await fetchComments();
			} catch (deleteError) {
				console.error(deleteError);
				setCommentError(deleteError.message || "Failed to delete response");
			}
		},
		[fetchComments, handleCancelReply, isAuthenticated, replyTargetId, token]
	);

	if (loading) {
		return <div className="post-loading">Loading story…</div>;
	}

	if (error && !post) {
		return <div className="post-error">{error}</div>;
	}

	if (!post) {
		return <div className="post-error">Story not found</div>;
	}

	return (
		<article className="post-container">
			{error && <div className="post-inline-error">{error}</div>}

			<header className="post-header">
				<h1 className="post-title">{post.title}</h1>
				{post.subtitle && <h2 className="post-subtitle">{post.subtitle}</h2>}

				<PostMeta
					author={post.author}
					publishedAt={post.publishedAt || post.createdAt}
					readingTime={post.readingTime}
					clapCount={clapCount}
					responseCount={post.responseCount}
					isAuthenticated={isAuthenticated}
					onClap={handleClap}
					clapping={clapping}
				/>

				{coverImageSrc && (
					<div className="post-cover-image">
						<img
							src={coverImageSrc}
							alt={post.coverImageMeta?.alt || post.title || "Story cover"}
							loading="lazy"
						/>
					</div>
				)}
			</header>

			<div className="post-content">
				{Array.isArray(post.content) &&
					post.content.map((block, index) =>
						renderBlock(block, index, renderCodeBlock)
					)}
			</div>

			<PostTags tags={post.tags} />

			<section className="post-comments">
				<h3>
					Responses <span>({post.responseCount ?? comments.length})</span>
				</h3>

				<CommentComposer
					canRespond={post.allowResponses !== false}
					content={commentContent}
					disabled={commentSubmitting}
					error={commentError}
					onChange={setCommentContent}
					onSubmit={handleSubmitComment}
				/>

				{commentsLoading && (
					<div className="post-loading">Loading responses…</div>
				)}

				{!commentsLoading && comments.length === 0 && (
					<div className="comment-empty">Be the first to respond.</div>
				)}

				{!commentsLoading && comments.length > 0 && (
					<ul className="comment-thread">
						{comments.map((comment) => (
							<CommentItem
								key={comment?.id || comment?._id}
								comment={comment}
								currentUserId={currentUserId}
								replyTargetId={replyTargetId}
								replyContent={replyContent}
								onChangeReplyContent={setReplyContent}
								onStartReply={handleStartReply}
								onCancelReply={handleCancelReply}
								onSubmitReply={handleSubmitReply}
								replyError={replyError}
								replySubmitting={replySubmitting}
								onDelete={handleDeleteComment}
							/>
						))}
					</ul>
				)}
			</section>
		</article>
	);
}
