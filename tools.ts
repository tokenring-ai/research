import createTopic from "./tools/createTopic.ts";
import deleteItem from "./tools/deleteItem.ts";
import deleteTopic from "./tools/deleteTopic.ts";
import listItems from "./tools/listItems.ts";
import listTopics from "./tools/listTopics.ts";
import readItem from "./tools/readItem.ts";
import writeItem from "./tools/writeItem.ts";

export default [listTopics, createTopic, deleteTopic, listItems, readItem, writeItem, deleteItem];
