/* An SQL file with all the SQL used so it is easier to move the database to another AWS account

Command to connect to the database:
psql --host=foodclub.cwlinpre6rr8.eu-north-1.rds.amazonaws.com --port=5432 --username=FoodCLUB123 --password --dbname=foodclub

Password to the database:
szqxrcjd */

CREATE TABLE users (
    UserID SERIAL PRIMARY KEY,
    Username VARCHAR(255) UNIQUE
);