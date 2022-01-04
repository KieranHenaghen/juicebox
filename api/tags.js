const express = require('express');
const tagsRouter = express.Router();
const { getAllTags, getPostsByTagName } = require('../db');

tagsRouter.use((req, res, next) => {
  console.log("A request is being made to /tags");

  next();
});

tagsRouter.get('/', async (req, res) => {
    const tags = await getAllTags();
    res.send({
        tags
    });
});

tagsRouter.get('/:tagName/posts', async (req, res, next) => {
  encodeURIComponent({ tagName }) = { tagName }
  const { tagName } = req.params;
  try {
    const posts = await getPostsByTagName(req.params);
    res.send({ posts: posts });
  }
  catch ({ name, message }) {
    next({ name, message });
  }
})

module.exports = tagsRouter;