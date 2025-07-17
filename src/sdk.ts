import mondaySdk from "monday-sdk-js";
import { SecureStorage } from "@mondaycom/apps-sdk";

export const monday = mondaySdk();
export const secureStorage = new SecureStorage();
export const GROUP_DEPENDENCY_NAME = '🔒 CrossBoard Dependency – DO NOT TOUCH';

export type Board = {
  id: string,
  items_page: {
    items: Item[]
  }
}
export type Item = {
  id: string,
  name: string,
  group: {
    title: string
  },
  column_values: {
    id: string,
    value: string,
    type: string
  }[]
}
export const fetchBoards = async (): Promise<Board[]> => {
  const query = `query {
  boards {
    id 
    items_page {
      items {
        id
        name
        group {
          title
        }
        column_values {
          id
          value
          type
        }
      }
    }
  }
}`
  const res = await monday.api(query)
  return res.data.boards
}

export const createNotification = async (userId: number, boardId: string, message: string) => {
  const mutation = `mutation {
    create_notification(
      text: ${JSON.stringify(message)},
      user_id: ${userId},
      target_id: ${boardId},
      target_type: Project
    ) {
      id
    }
  }`
  await monday.api(mutation)
}

export const updateItemName = async (boardId: string, itemId: string, newName: string, oldName: string) => {
  const match = oldName.match(/^(.*?) \(linked from (.*?)\) \[ref:(\d+)\]$/);

  const [, _oldName, boardName, refId] = match || ["err", "error", "name", "parse"];

  const columnValues = JSON.stringify({
    name: `${newName} (linked from ${boardName}) [ref:${refId}]`
  });

  const mutation = `mutation {
             change_multiple_column_values(
                item_id: ${itemId},
                board_id: ${boardId},
                column_values: ${JSON.stringify(columnValues)}
            ) {
                id
            }
        }`

  await monday.api(mutation)
}

export const deleteItem = async (itemId: string) => {
  const mutation = `mutation {
            delete_item (item_id: ${itemId}) {
                id
            }
        }`
  await monday.api(mutation)
}

export const updateItemValue = async (boardId: string, itemId: string, colId: string, newValue: any) => {
  const escapedValue = JSON.stringify(typeof newValue === 'string' ? JSON.parse(newValue) : newValue);
  const mutation = `mutation {
              change_column_value(
                item_id: ${itemId},
                board_id: ${boardId},
                column_id: ${JSON.stringify(colId)},
                value: ${JSON.stringify(escapedValue)}
              ) {
                id
            }
          }`

  await monday.api(mutation)
}
