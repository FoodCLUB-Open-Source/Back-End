/* An SQL file with all the SQL used so it is easier to move the database to another AWS account

Command to connect to the database:
psql --host=foodclub.cwlinpre6rr8.eu-north-1.rds.amazonaws.com --port=5432 --username=FoodCLUB123 --password --dbname=foodclub

Password to the database:
szqxrcjd */

/* CREATING TABLES */
CREATE TABLE users (
  user_id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  phone_number VARCHAR(255),
  profile_picture VARCHAR(255),
  user_bio TEXT,
  gender VARCHAR(10),
  user_created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  date_of_birth DATE NOT NULL
);

CREATE TABLE posts (
  post_id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(user_id),
  post_title VARCHAR(255) NOT NULL,
  post_description TEXT,
  video_name VARCHAR(255) NOT NULL,
  thumbnail_name VARCHAR(255) NOT NULL,
  post_created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  post_updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  recipe_id INTEGER REFERENCES recipes(recipe_id),
  post_hashtags INTEGER[]
);

CREATE TABLE categories (
  category_id SERIAL PRIMARY KEY,
  category_name VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE post_categories (
  post_id INTEGER REFERENCES posts(post_id),
  category_id INTEGER REFERENCES categories(category_id)
);

CREATE TABLE bookmarks (
    bookmark_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    post_id INTEGER NOT NULL REFERENCES posts(post_id),
    bookmark_created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE hashtags (
  hashtag_id SERIAL PRIMARY KEY,
  hashtag_name VARCHAR(255) UNIQUE NOT NULL,
  hashtag_created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE recipes (
  recipe_id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES posts(post_id),
  recipe_description TEXT,
  recipe_ingredients VARCHAR[],
  recipe_equipment VARCHAR[],
  recipe_steps VARCHAR[],
  preparation_time INTEGER,
  recipe_servings INTEGER
);

/* INSERTING DATA */
INSERT INTO users (username, email, password, phone_number, profile_picture, user_bio, gender, date_of_birth)
VALUES ('user1', 'user1@example.com', 'password1', '1234567890', 'https://example.com/profile1.jpg', 'User 1 bio', 'male', '2001-01-01'),
       ('user2', 'user2@example.com', 'password2', '2345678901', 'https://example.com/profile2.jpg', 'User 2 bio', 'male', '2001-01-01'),
       ('user3', 'user3@example.com', 'password3', '3456789012', 'https://example.com/profile3.jpg', 'User 3 bio', 'male', '2001-01-01'),
       ('user4', 'user4@example.com', 'password4', '4567890123', 'https://example.com/profile4.jpg', 'User 4 bio', 'male', '2001-01-01'),
       ('user5', 'user5@example.com', 'password5', '5678901234', 'https://example.com/profile5.jpg', 'User 5 bio', 'male', '2001-01-01');

INSERT INTO posts (user_id, post_title, post_description, video_name, thumbnail_name, recipe_id, post_hashtags)
VALUES (1, 'Post 1 Title', 'Post 1 description', 'https://example.com/video1.mp4', 'https://example.com/thumbnail1.jpg', 1, ARRAY[1, 2, 3]),
       (2, 'Post 2 Title', 'Post 2 description', 'https://example.com/video2.mp4', 'https://example.com/thumbnail2.jpg', 2, ARRAY[1, 2, 3]),
       (3, 'Post 3 Title', 'Post 3 description', 'https://example.com/video3.mp4', 'https://example.com/thumbnail3.jpg', 3, ARRAY[1, 2, 3]),
       (4, 'Post 4 Title', 'Post 4 description', 'https://example.com/video4.mp4', 'https://example.com/thumbnail4.jpg', 4, ARRAY[1, 2, 3]),
       (5, 'Post 5 Title', 'Post 5 description', 'https://example.com/video5.mp4', 'https://example.com/thumbnail5.jpg', 5, ARRAY[1, 2, 3]);

INSERT INTO categories (category_name)
VALUES ('Vegan'),
       ('Vegetarian'),
       ('Breakfast'),
       ('Lunch'),
       ('Dinner'),
       ('Mexican'),
       ('Italian'),
       ('Chinese'),
       ('Indian'),
       ('Korean'),
       ('Thai'),
       ('American'),
       ('Scottish'),
       ('English'),
       ('Mediterranean'),
       ('Gluten Free'),
       ('Dairy Free'),
       ('Paleo'),
       ('Keto'),
       ('Halal'),
       ('Pescetarian'),
       ('Snacks'),
       ('Dessert'),
       ('Supper'),
       ('Sides'),
       ('Beverages'),
       ('Cocktails'),
       ('Low Calories'),
       ('Low Carbohydrates'),
       ('High Protein'),
       ('High Fiber');

INSERT INTO post_categories (post_id, category_id)
VALUES (43, 6),
       (43, 7),
       (43, 8),
       (43, 9),
       (43, 10);

INSERT INTO bookmarks (user_id, post_id)
VALUES (1, 3),
       (1, 3),
       (2, 4),
       (2, 5),
       (3, 5);

INSERT INTO hashtags (hashtag_name)
VALUES ('#food'),
       ('#foodie'),
       ('#ilovefood'),
       ('#yummy'),
       ('#foodclub');
       
INSERT INTO recipes (post_id, recipe_description, recipe_ingredients, recipe_equipment, recipe_steps, preparation_time, recipe_servings)
VALUES (1, 'Recipe 1', '{"ingredient 1", "ingredient 2", "ingredient 3"}', '{"equipment 1", "equipment 2"}', '{"step 1", "step 2", "step 3"}', 30, 4),
       (2, 'Recipe 2', '{"ingredient 4", "ingredient 5", "ingredient 6"}', '{"equipment 3", "equipment 4"}', '{"step 1", "step 2", "step 3"}', 45, 6),
       (3, 'Recipe 3', '{"ingredient 7", "ingredient 8", "ingredient 9"}', '{"equipment 5", "equipment 6"}', '{"step 1", "step 2", "step 3"}', 60, 8),
       (4, 'Recipe 4', '{"ingredient 10", "ingredient 11", "ingredient 12"}', '{"equipment 7", "equipment 8"}', '{"step 1", "step 2", "step 3"}', 75, 10),
       (5, 'Recipe 5', '{"ingredient 13", "ingredient 14", "ingredient 15"}', '{"equipment 9", "equipment 10"}', '{"step 1", "step 2", "step 3"}', 90, 12);
