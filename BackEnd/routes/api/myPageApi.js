const express = require("express");
const Customer = require("../../mongoose/schemas/customer.js");
const Post = require("../../mongoose/schemas/post.js");
const router = express.Router();
const Comment = require("../../mongoose/schemas/comment.js");

// 사용자 마이페이지 조회
router.get("/", async (req, res) => {
  try {
    // 로그인한 사용자의 user_id를 토대로 해당 사용자 정보 조회
    const loggedInUserId = req.query.userId; // 이 정보는 로그인 미들웨어에서 설정되어야 합니다.

    const customer = await Customer.findOne({ user_id: loggedInUserId }).exec();

    if (!customer) {
      // 사용자를 찾을 수 없음
      return res.status(404).json({ error: "User not found" });
    }

    // 사용자 정보 응답
    res.json(customer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Mypage Server Error" });
  }
});

// 특정 사용자의 모든 게시글 조회
router.get("/:userId/posts", async (req, res) => {
  try {
    const userId = req.params.userId;

    // 사용자의 ID를 기반으로 해당 사용자의 게시글을 조회
    const posts = await Post.find({ userId }).exec();

    // 해당 사용자의 게시글을 찾지 못한 경우
    if (!posts || posts.length === 0) {
      return res.status(404).json({ error: "User's posts not found" });
    }

    // 사용자의 게시글 응답
    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Mypage Server Error" });
  }
});

// 특정 사용자의 모든 댓글 조회
router.get("/:userId/comments", async (req, res) => {
  try {
    const userId = req.params.userId;
    const comments = await Comment.find({ userId });
    res.json(comments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Mypage Server Error" });
  }
});

// 사용자 정보 수정
router.put("/", async (req, res) => {
  try {
    // 로그인한 사용자의 user_id를 토대로 해당 사용자 정보 수정
    const loggedInUserId = req.query.userId; // 이 정보는 로그인 미들웨어에서 설정되어야 합니다.

    const result = await Customer.updateOne(
      { user_id: loggedInUserId },
      { $set: req.body }
    );

    if (result.nModified === 0) {
      // 수정된 데이터가 없음
      return res.status(400).json({ error: "No changes made" });
    }

    // 수정 성공 응답
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Mypage Server Error" });
  }
});

// 사용자 탈퇴
router.delete("/", async (req, res) => {
  try {
    // 로그인한 사용자의 user_id를 토대로 해당 사용자 삭제
    const loggedInUserId = req.user.userId; // 이 정보는 로그인 미들웨어에서 설정되어야 합니다.

    const result = await Customer.deleteOne({ user_id: loggedInUserId });

    if (result.deletedCount === 0) {
      // 삭제된 데이터가 없음
      return res.status(404).json({ error: "User not found" });
    }

    // 삭제 성공 응답
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Mypage Server Error" });
  }
});

module.exports = router;
