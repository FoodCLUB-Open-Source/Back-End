/* An SQL file with all the SQL used so it is easier to move the database to another AWS account

Command to connect to the database:
psql --host=foodclub.cwlinpre6rr8.eu-north-1.rds.amazonaws.com --port=5432 --username=FoodCLUB123 --password --dbname=foodclub

Password to the database:
szqxrcjd */

CREATE TABLE users (
  user_id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  phone_number VARCHAR(255),
  profile_picture VARCHAR(255),
  bio TEXT,
  gender VARCHAR(10),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
  category_id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE posts (
  post_id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(user_id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  video_name VARCHAR(255) NOT NULL,
  thumbnail_name VARCHAR(255) NOT NULL,
  category_id INTEGER REFERENCES categories(category_id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bookmarks (
    bookmark_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    post_id INTEGER NOT NULL REFERENCES posts(post_id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);




/* INSERTING DATA */
INSERT INTO users (username, email, password, phone_number, profile_picture, bio)
VALUES ('user1', 'user1@example.com', 'password1', '1234567890', 'https://example.com/profile1.jpg', 'User 1 bio'),
       ('user2', 'user2@example.com', 'password2', '2345678901', 'https://example.com/profile2.jpg', 'User 2 bio'),
       ('user3', 'user3@example.com', 'password3', '3456789012', 'https://example.com/profile3.jpg', 'User 3 bio'),
       ('user4', 'user4@example.com', 'password4', '4567890123', 'https://example.com/profile4.jpg', 'User 4 bio'),
       ('user5', 'user5@example.com', 'password5', '5678901234', 'https://example.com/profile5.jpg', 'User 5 bio');

INSERT INTO categories (name, description)
VALUES ('Category 1', 'Category 1 description'),
       ('Category 2', 'Category 2 description'),
       ('Category 3', 'Category 3 description'),
       ('Category 4', 'Category 4 description'),
       ('Category 5', 'Category 5 description');

INSERT INTO posts (user_id, title, description, video_url, thumbnail_url, category_id)
VALUES (1, 'Post 1 Title', 'Post 1 description', 'https://example.com/video1.mp4', 'https://example.com/thumbnail1.jpg', 1),
       (2, 'Post 2 Title', 'Post 2 description', 'https://example.com/video2.mp4', 'https://example.com/thumbnail2.jpg', 2),
       (3, 'Post 3 Title', 'Post 3 description', 'https://example.com/video3.mp4', 'https://example.com/thumbnail3.jpg', 3),
       (4, 'Post 4 Title', 'Post 4 description', 'https://example.com/video4.mp4', 'https://example.com/thumbnail4.jpg', 4),
       (5, 'Post 5 Title', 'Post 5 description', 'https://example.com/video5.mp4', 'https://example.com/thumbnail5.jpg', 5);

INSERT INTO recipes (post_id, recepie_description, ingredients, equipment, steps, preparation_time, servings)
VALUES (1, 'Recipe 1', '{"ingredient 1", "ingredient 2", "ingredient 3"}', '{"equipment 1", "equipment 2"}', '{"step 1", "step 2", "step 3"}', 30, 4),
       (2, 'Recipe 2', '{"ingredient 4", "ingredient 5", "ingredient 6"}', '{"equipment 3", "equipment 4"}', '{"step 1", "step 2", "step 3"}', 45, 6),
       (3, 'Recipe 3', '{"ingredient 7", "ingredient 8", "ingredient 9"}', '{"equipment 5", "equipment 6"}', '{"step 1", "step 2", "step 3"}', 60, 8),
       (4, 'Recipe 4', '{"ingredient 10", "ingredient 11", "ingredient 12"}', '{"equipment 7", "equipment 8"}', '{"step 1", "step 2", "step 3"}', 75, 10),
       (5, 'Recipe 5', '{"ingredient 13", "ingredient 14", "ingredient 15"}', '{"equipment 9", "equipment 10"}', '{"step 1", "step 2", "step 3"}', 90, 12);

INSERT INTO bookmarks (user_id, post_id, created_at)
VALUES (1, 3, '2023-05-01 08:30:00'),
       (1, 3, '2023-05-02 09:45:00'),
       (2, 4, '2023-05-03 14:15:00'),
       (2, 5, '2023-05-04 16:00:00'),
       (3, 5, '2023-05-05 19:30:00');