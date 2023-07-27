/* An SQL file with all the SQL used so it is easier to move the database to another AWS account

Command to connect to the database:
psql --host=foodclub.cmfx3corion7.eu-west-2.rds.amazonaws.com --port=5432 --username=foodclub --password --dbname=foodclub

Password to the database:
szqxrcjd */

/* CREATING TABLES */
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  phone_number VARCHAR(255),
  profile_picture VARCHAR(255),
  user_bio TEXT,
  gender VARCHAR(10),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  date_of_birth DATE NOT NULL
);

CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  video_name VARCHAR(255) NOT NULL,
  thumbnail_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE posts_categories (
  post_id INTEGER REFERENCES posts(id),
  category_name VARCHAR(255) UNIQUE REFERENCES categories(name),
  PRIMARY KEY (post_id, category_name)
);

CREATE TABLE bookmarks (
    user_id INTEGER NOT NULL REFERENCES users(id),
    post_id INTEGER NOT NULL REFERENCES posts(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, post_id)
);

CREATE TABLE posts_hashtags (
  post_id INTEGER REFERENCES posts(id),
  hashtag_name VARCHAR(255) NOT NULL,
  PRIMARY KEY (post_id, hashtag_name)
);

CREATE TABLE recipes (
  id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES posts(id),
  recipe_description TEXT,
  recipe_ingredients VARCHAR[],
  recipe_equipment VARCHAR[],
  recipe_steps VARCHAR[],
  preparation_time INTEGER,
  recipe_servings INTEGER,
  serving_size INTEGER
);

CREATE TABLE blocked_users (
  user_id INTEGER NOT NULL REFERENCES users(id),
  blocked_user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, blocked_user_id)
);

CREATE TABLE following (
  user_id INTEGER NOT NULL REFERENCES users(id),
  user_following_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, user_following_id)
);

CREATE TABLE report (
  user_id INTEGER NOT NULL REFERENCES users(id),
  reported_user_id INTEGER NOT NULL REFERENCES users(id),
  post_id INTEGER NOT NULL REFERENCES posts(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, post_id)
);

/* INSERTING DATA */
INSERT INTO users (username, email, password, phone_number, profile_picture, user_bio, gender, date_of_birth)
VALUES ('user1', 'user1@example.com', 'password1', '1234567890', 'https://example.com/profile1.jpg', 'User 1 bio', 'male', '2001-01-01'),
       ('user2', 'user2@example.com', 'password2', '2345678901', 'https://example.com/profile2.jpg', 'User 2 bio', 'male', '2001-01-01'),
       ('user3', 'user3@example.com', 'password3', '3456789012', 'https://example.com/profile3.jpg', 'User 3 bio', 'male', '2001-01-01'),
       ('user4', 'user4@example.com', 'password4', '4567890123', 'https://example.com/profile4.jpg', 'User 4 bio', 'male', '2001-01-01'),
       ('user5', 'user5@example.com', 'password5', '5678901234', 'https://example.com/profile5.jpg', 'User 5 bio', 'male', '2001-01-01');

INSERT INTO posts (user_id, title, description, video_name, thumbnail_name)
VALUES (1, 'Post 1 Title', 'Post 1 description', 'https://example.com/video1.mp4', 'https://example.com/thumbnail1.jpg'),
       (2, 'Post 2 Title', 'Post 2 description', 'https://example.com/video2.mp4', 'https://example.com/thumbnail2.jpg'),
       (3, 'Post 3 Title', 'Post 3 description', 'https://example.com/video3.mp4', 'https://example.com/thumbnail3.jpg'),
       (4, 'Post 4 Title', 'Post 4 description', 'https://example.com/video4.mp4', 'https://example.com/thumbnail4.jpg'),
       (5, 'Post 5 Title', 'Post 5 description', 'https://example.com/video5.mp4', 'https://example.com/thumbnail5.jpg');

INSERT INTO categories (name)
VALUES ('Vegetarian'), ('Vegan'), ('Gluten-Free'), ('Wheat-free'),
       ('Dairy-Free'), ('Nut-Free'), ('Egg-Free'), ('Seafood-Free'), ('Soy-Free'),
       ('Low-Carb'), ('Keto'), ('Paleo'), ('Halal'), ('Kosher'), ('Breakfast'),
       ('Brunch'), ('Lunch'), ('Dinner'), ('Snacks'), ('Appetizers'),
       ('Mains'), ('Sides'), ('Desserts'), ('Soup'), ('Salad'),
       ('Bread'), ('Beverages'), ('Cocktails'), ('Low-Budget'),
       ('Mid-Budget'), ('High-Budget'), ('Fast'), ('Slow'), ('Beginner'),
       ('Intermediate'), ('Advanced'), ('Afghan'), ('Albanians'), ('Algerian'),
       ('Andorran'), ('Angolan'), ('Antiguan'), ('Argentinan'), ('Armenian'), 
       ('Australian'), ('Austrian'), ('Azerbaijani'), ('Bahamian'), ('Bahraini'),
       ('Bangladeshi'), ('Barbadian'), ('Belarusian'), ('Belgian'),         
       ('Belizean'), ('Beni'),  ('Bhutanese'), ('Bolivian'), ('Bosnian'),
       ('Motswana'), ('Brazilian'), ('Bruneian'), ('Bulgarian'),
       ('Burkinabé'), ('Burundian'), ('Ivorian'), ('Cape Verdean'),
       ('Cambodian'), ('Cameroonian'), ('Canadian'), ('Central African'),
       ('Chadian'),  ('Chilean'),  ('Chinese'), ('Colombian'),
       ('Comorian'), ('Congolese'), ('Costa Rican'), ('Croatian'),  ('Cubans'),
       ('Cypriot'), ('Czech'), ('Dane'), ('Djiboutian'), ('Dominican'),
       ('Ecuadorian'), ('Egyptian'), ('Salvadoran'), ('Equatoguinean'),
       ('Eritrean'), ('Estonians'),  ('Swazi'), ('Ethiopian'), ('Fijian'), 
       ('Finnish'), ('French'), ('Gabonese'), ('Gambian'), ('Georgian'),
       ('German'), ('Ghanaian'), ('Greek'),  ('Grenadian'), ('Guatemalan'),
       ('Guinean'),  ('Bissau-Guinean'), ('Guyanese'), ('Haitians'),
       ('Nuncio'), ('Honduran'), ('Hungarian'), ('Icelander'), ('Indian'), 
       ('Indonesian'), ('Iranian'), ('Iraqi'), ('Irish'), ('Israeli'),
       ('Italian'), ('Jamaican'), ('Japanese'), ('Jordanian'), ('Kazakh'), 
       ('Kenyan'), ('Gilbertese'), ('Kuwaiti'), ('Kyrgyz'), ('Lao'),
       ('Latvian'), ('Lebanese'), ('Mosotho'), ('Liberian'), ('Libyan'), 
       ('Liechtensteiner'), ('Lithuanian'), ('Luxembourger'),
       ('Madagascan'), ('Malawian'), ('Malaysian'), ('Dhivehin'),
       ('Malian'), ('Maltese'), ('Micronesian'), ('Mauritanian'),
       ('Mauritian'), ('Mexican'), ('Moldovan'),
       ('Monégasque'), ('Mongolian'), ('Montenegrin'), ('Moroccan'),
       ('Mozambican'), ('Myanma'), ('Namibian'), ('Nauruan'), ('Nepali'),
       ('Dutch'), ('Kiwi'), ('Nicaraguan'), ('Nigerien'), ('Nigerian'),
       ('Korean'), ('Norwegian'), ('Omani'), ('Pakistani'),
       ('Palauan'), ('Palestinian'), ('Panamanian'), ('Papuan'),
       ('Paraguayan'), ('Peruvian'), ('Filipino'), ('Polish'),
       ('Portugese'), ('Qatari'), ('Romanian'), ('Russian'), 
       ('Rwandan'), ('Kittitian'), ('Nevisians'), ('Saint Lucian'),
       ('Vincentians'), ('Samoan'), ('Sammarinese'), ('Sao Tomean'),
       ('Saudi'), ('Senegalese'), ('Serb'), ('Seychellois'),
       ('Sierra Leonean'), ('Singaporean'), ('Slovak'), ('Slovenian'), 
       ('Solomon Islander'), ('Somali'), ('South African'), 
       ('South Sudanese'), ('Spanish'), ('Sri Lankan'), ('Sudanese'), 
       ('Surinamese'), ('Swedish'), ('Swiss'), ('Syrian'), ('Tajik'),
       ('Tanzanian'), ('Thai'), ('Timorese'), ('Togolese'), ('Tongan'), 
       ('Trinbagonian'), ('Tunisian'), ('Turkish'), ('Turkmen'), ('Tuvaluan'),
       ('Ugandan'), ('Ukrainian'),('Emirati'), ('British'), ('English'), 
       ('Scottish'), ('Welsh'), ('American'), ('Uruguayan'),  
       ('Uzbekistani'), ('Vanuatuan'), ('Venezuelan'), ('Vietnamese'),
       ('Yemeni'), ('Zambian'), ('Zimbabwean');

INSERT INTO posts_categories (post_id, category_name)
VALUES (6, 'Vegan'),
       (7, 'Vegetarian'),
       (8, 'Dinner'),
       (9, 'Italian');

INSERT INTO bookmarks (user_id, post_id)
VALUES (1, 6),
       (1, 7),
       (2, 7),
       (2, 8),
       (3, 9);

INSERT INTO posts_hashtags (post_id, hashtag_name)
VALUES (6, '#food'),
       (6, '#foodie'),
       (6, '#ilovefood'),
       (6, '#yummy'),
       (6, '#foodclub');
       
INSERT INTO recipes (post_id, recipe_description, recipe_ingredients, recipe_equipment, recipe_steps, preparation_time, recipe_servings)
VALUES (1, 'Recipe 1', '{"ingredient 1", "ingredient 2", "ingredient 3"}', '{"equipment 1", "equipment 2"}', '{"step 1", "step 2", "step 3"}', 30, 4),
       (2, 'Recipe 2', '{"ingredient 4", "ingredient 5", "ingredient 6"}', '{"equipment 3", "equipment 4"}', '{"step 1", "step 2", "step 3"}', 45, 6),
       (3, 'Recipe 3', '{"ingredient 7", "ingredient 8", "ingredient 9"}', '{"equipment 5", "equipment 6"}', '{"step 1", "step 2", "step 3"}', 60, 8),
       (4, 'Recipe 4', '{"ingredient 10", "ingredient 11", "ingredient 12"}', '{"equipment 7", "equipment 8"}', '{"step 1", "step 2", "step 3"}', 75, 10),
       (5, 'Recipe 5', '{"ingredient 13", "ingredient 14", "ingredient 15"}', '{"equipment 9", "equipment 10"}', '{"step 1", "step 2", "step 3"}', 90, 12);

INSERT INTO blocked_users (user_id, blocked_user_id)
VALUES (1, 2),
       (2, 1),
       (3, 4),
       (4, 5),
       (5, 1);

INSERT INTO following (user_id, user_following_id)
VALUES (1, 2),
       (2, 1),
       (3, 4),
       (4, 5),
       (5, 1);

INSERT INTO report (user_id, reported_user_id, post_id)
VALUES  (1, 2, 6),
        (3, 2, 6),
        (4, 2, 6),
        (5, 2, 6);
