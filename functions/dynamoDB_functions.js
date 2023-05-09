/* Functions used to access DynamoDB */

const dynamoDB = require('../dynamoDB');

/* Get a single item by primary key 
	How to use: getItem("Views", {post_id: 1, view_id: "asda"}) where post_id is Partition Key and view_id is Sort Key
	view_id will need to be a UUID. and post_id needs to be from postgreSQL

*/
async function getItemPrimaryKey(params) {

	try {
	  const data = await dynamoDB.get(params);
	  return data.Item;
	} catch (error) {
	  console.error("Error getting item:", error);
	  throw error;
	}
}

/* Get all items that belong to the specific Partition Key*/
async function getItemPartitionKey(params) {

	try {
	  const data = await dynamoDB.query(params);
	  return data.Items;
	} catch (error) {
	  console.error("Error getting item:", error);
	  throw error;
	}
}

/* Put an item into the table
	How to use: putItem("Views", {post_id: 5, view_id: "asasdda", message: "Testing"}) where post_id is Partition Key and view_id is Sort Key
	view_id will need to be a UUID. and post_id needs to be from postgreSQL
*/
async function putItem(tableName, item) {
	const params = {
	  TableName: tableName,
	  Item: item
	};
  
	try {
	  await dynamoDB.put(params);
	  return item;
	} catch (error) {
	  console.error("Error putting item:", error);
	  throw error;
	}
}

// Delete an item by primary key
async function deleteItem(tableName, primaryKey) {
	const params = {
	  TableName: tableName,
	  Key: primaryKey
	};
  
	try {
	  await dynamoDB.delete(params);
	  return "Item deleted";
	} catch (error) {
	  console.error("Error deleting item:", error);
	  throw error;
	}
  }

module.exports = { getItemPrimaryKey, getItemPartitionKey, putItem, deleteItem }