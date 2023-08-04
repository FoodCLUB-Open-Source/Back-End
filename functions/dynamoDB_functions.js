/* Functions used to access DynamoDB */
import dynamoDB from "../dynamoDB.js";

/* Get a single item by primary key */
export const getItemPrimaryKey = async (params) => {
	try {
	  const data = await dynamoDB.get(params);
	  return data.Item;
	} catch (error) {
	  console.error("Error getting item:", error);
	  throw error;
	}
};

/* Get all items that belong to the specific Partition Key*/
export const getItemPartitionKey = async (params) => {
	try {
	  const data = await dynamoDB.query(params);
	  return data.Items;
	} catch (error) {
	  console.error("Error getting item:", error);
	  throw error;
	}
};

/* Put an item into the table */
export const putItem = async (tableName, item) => {
	try {
		const params = {
			TableName: tableName,
			Item: item
		};

		await dynamoDB.put(params);
		return item;
	} catch (error) {
	  console.error("Error putting item:", error);
	  throw error;
	}
};

export const updateItem = async (params) => {
	try {
		return await dynamoDB.update(params);
	} catch (err) {
		console.error('Unable to update item. Error JSON:', JSON.stringify(err, null, 2));
		throw err;
	}
};

// Delete an item by primary key
export const deleteItem = async (params) => {
	try {
	  await dynamoDB.delete(params);
	  return "Item deleted";
	} catch (error) {
	  console.error("Error deleting item:", error);
	  throw error;
	}
};