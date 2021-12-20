const { Client } = require('pg');

const client = new Client('postgres://localhost:5432/juicebox-dev');

async function getAllUsers() {
    const { rows } = await client.query(
        `SELECT id, username, name, location, active
        FROM users;
    `);
    return rows;
}

async function createUser({ 
    username, 
    password,
    name,
    location
}) {
    try {
        const { rows: [ user ] } = await client.query(`
            INSERT INTO users(username, password, name, location)
            VALUES (${ username }, ${ password }, ${ name }, ${ location })
            ON CONFLICT (username) DO NOTHING
            RETURNING *;
        `, [username, password, name, location]);
        return user;
    }
    catch (error) {
        throw error;
    }
}

async function updateUser(id, fields = {}) {
    const setString = Object.keys(fields).map(
        (key, index) => `"${ key }"=$${ index + 1}`
    ).join(', ');
    if (setString.length === 0) {
        return;
    }
    try {
        const { rows: [ user ] } = await client.query(`
        UPDATE users
        SET ${ setString }
        WHERE id=${ id }
        RETURNING *;
        `, Object.values(fields));
        return user;
    }
    catch (error) {
        throw error;
    }
}

async function createPost({
    authorId,
    title,
    content,
    tags = []
}) {
    try {
        const { rows: [ post ] } = await client.query(`
            INSERT INTO posts("authorId", title, content)
            VALUES (${ authorId }, ${ title }, ${ content })
            RETURNING *;
        `, [authorId, title, content]);
        const tagList = await createTags(tags);
        return await addTagsToPost(post.id, tagList);
    }
    catch (error) {
        throw error;
    }
}

async function updatePost(postId, fields = {
    title,
    content,
    active,
    tags
}) {
    const { tags } = fields;
    delete fields.tags;
    const setString = Object.keys(fields).map(
        (key, index) => `"${ key }"=$${ index + 1}`
    ).join(', ');
    
    try {
        if (setString.length > 0) {
            const { rows: [ post ] } = await client.query(`
                UPDATE posts
                SET ${ setString }
                WHERE "authorId"=${ postId }
                RETURNING *;
            `, Object.values(fields));
        }
        if (tags === undefined) {
            return await getPostById(postId);
        }
        const tagList = await createTags(tags);
        const tagListIdString = tagList.map(
            tag => `${ tag.id }`
        ).join(', ');
        await client.query(`
            DELETE FROM post_tags
            WHERE "tagId"
            NOT IN (${ tagListIdString })
            AND "postId"=${ postId };
        `, [postId]);
        await addTagsToPost(postId, tagList);
        return await getPostsById(postId);
    }
    catch (error) {
        throw error;
    }
}

async function getAllPosts() {
    try {
        const { rows: postIds } = await client.query(`
            SELECT id
            FROM posts;
        `);
        const posts = await Promise.all(postIds.map(
            post => getPostById( post.id )
        ));

        return posts;
    } catch (error) {
        throw error;
    }
}

async function getPostsByUser(userId) {
    try {
        const { rows: postIds } = client.query(`
            SELECT id
            FROM posts
            WHERE "authorId"=${ userId };
        `);
        const posts = await Promise.all(postIds.map(
            post => getPostById( post.id )
        ));
  
        return posts;
    } 
    catch (error) {
        throw error;
    }
}

async function getUserById(userId) {
    try {
        const { rows: [ user ] } = await client.query(`
            SELECT id, username, name, location, active
            FROM users
            WHERE id=${ userId };
        `);
        if (!user) {
            return null;
        }
        else {
            
            user.posts = await getPostsByUser(userId);
            return user;
        }
    }
    catch (error) {
        throw error;
    }
}

async function createTags(tagList) {
    if (tagList.length === 0) {
        return;
    }
    const insertValues = tagList.map(
        (_, index) => `$${index + 1}`).join('), (');
    const selectValues = tagList.map(
        (_, index) => `$${index + 1}`).join(', ');
    try {
        const { rows } = await client.query(`
            INSERT INTO tags(name)
            VALUES (${ insertValues })
            ON CONFLICT (name) DO NOTHING; 
            SELECT * FROM tags
            WHERE name
            IN (${ selectValues });   
        `)
        return rows;
    }
    catch (error) {
        throw error;
    }
}

async function createPostTag(postId, tagId) {
    try {
        await client.query(`
            INSERT INTO post_tags("postId", "tagId")
            VALUES (${ postId }, ${ tagId })
            ON CONFLICT ("postId", "tagId") DO NOTHING;        
        `, [postId, tagId]);
    }
    catch (error) {
        throw error;
    }
}

async function getPostById(postId) {
    try {
        const { rows: [ post ] } = await client.query(`
            SELECT *
            FROM posts
            WHERE id=${ postId };        
        `, [postId]);
        const { rows: tags } = await client.query(`
            SELECT tags.*
            FROM tags
            JOIN post_tags ON tags.ide=post_tags."tagId"
            WHERE post_tags."postId"=${ postId };
        `, [postId]);
        const { rows: [ author ] } = await client.query(`
            SELECT id, username, name, location
            FROM users
            WHERE id=${ post.authorId };
        `, [post.authorId]);
        post.tags = tags;
        post.author = author;
        delete post.authorId;
        return post;
    }
    catch (error) {
        throw error;
    }
}

async function addTagsToPost(postId, tagList) {
    try {
        const createPostTagPromises = tagList.map(
            tag => createPostTag(postId, tag.id)
        );
        await Promise.all(createPostTagPromises);
        return await getPostById(postId);
    }
    catch (error) {
        throw error;
    }
}

async function getPostsByTagName(tagName) {
    try {
        const { rows: postIds } = await client.query(`
            SELECT posts.id
            FROM posts
            JOIN post_tags ON posts.id=post_tags."postId"
            JOIN tags ON tags.id=post_tags."tagId"
            WHERE tags.name=${ tagName };        
        `, [tagName]);
        return await Promise.all(postIds.map(
            post => getPostById(post.id)
        ));
    }
    catch (error) {
        throw error;
    }
}

module.exports = {
    client,
    getAllUsers,
    createUser,
    updateUser,
    createPost,
    updatePost,
    getAllPosts,
    getPostsByUser,
    getUserById,
    createTags,
    createPostTag,
    getPostById,
    addTagsToPost,
    getPostsByTagName,
}