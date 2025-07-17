import { Request, Response } from 'express';
import { createNotification, deleteItem, fetchBoards, GROUP_DEPENDENCY_NAME, Item, updateItemName, updateItemValue } from '../sdk';
import { tryCatch } from '../libs/try-catch';

type Event = {
  type: 'update_name' | 'item_archived' | 'item_deleted' | 'update_column_value',
  pulseId: number,
  value: any,
  previousValue: any,
  columnTitle: string,
  columnId: string,
  columnType: string
}


export const handleWebhook = async (req: Request, res: Response) => {
  const body = req.body;

  if (body.challenge) {
    return res.json({ challenge: body.challenge });
  }

  const event = body.event as Event;

  if (!event) return res.sendStatus(400)
  const allowedTypes = ['update_name', 'update_column_value', 'item_archived', 'item_deleted'];

  if (!allowedTypes.includes(event.type)) return res.sendStatus(200);

  const { data: boards, error } = await tryCatch(fetchBoards())
  if (error) {
    return res.status(500).json({ error: error.message })
  }

  for (const board of boards) {
    for (const item of board.items_page.items) {
      if (item.group?.title !== GROUP_DEPENDENCY_NAME) continue;

      const isLinked = item.name.includes(`[ref:${event.pulseId}]`);
      if (!isLinked) continue;

      const userIds = extractUserIDs(item);
      const msg = buildNotificationMessage(event, item);
      if (event.type === 'update_name') {
        const { error } = await tryCatch(updateItemName(board.id, item.id, event.value.name, item.name))
        if (error) {
          return res.status(500).json({ error: error.message })
        }
        const { error: errNotify } = await tryCatch(notifyUsers(userIds, board.id, msg))
        if (errNotify) {
          return res.status(500).json({ error: errNotify.message })
        }
        return res.sendStatus(200);
      }
      if (event.type === 'item_deleted' || event.type === 'item_archived') {
        const { error } = await tryCatch(deleteItem(item.id))
        if (error) {
          return res.status(500).json({ error: error.message })
        }
        const { error: errNotify } = await tryCatch(notifyUsers(userIds, board.id, msg))
        if (errNotify) {
          return res.status(500).json({ error: errNotify.message })
        }
        return res.sendStatus(200);
      }
      if (event.type === 'update_column_value') {
        const col = item.column_values.find(c => c.id === event.columnId);
        if (!col) continue;
        if (['color', 'status'].includes(event.columnType)) {
          const raw = event.value;
          if (raw.label && raw.label.index !== undefined) {
            event.value = JSON.stringify({ index: raw.label.index });
          }
        }

        const { error } = await tryCatch(updateItemValue(board.id, item.id, col.id, event.value))
        if (error) {
          return res.status(500).json({ error: error.message })
        }

        const { error: errNotify } = await tryCatch(notifyUsers(userIds, board.id, msg))
        if (errNotify) {
          return res.status(500).json({ error: errNotify.message })
        }
        return res.sendStatus(200);
      }
    }
  }

  res.status(200).json({ message: 'Webhook received' });
};

function parseItemNameParts(name: string) {
  const match = name.match(/^(.*?) \(linked from ([^)]+)\) \[ref:\d+\]$/);
  if (match) return [match[1].trim(), match[2]];
  return [name, 'unknown'];
}

function extractSimpleLabel(raw: string) {
  if (!raw) return '';
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;

  if (parsed.label?.text) return parsed.label.text;
  if (parsed.date) return parsed.date;
  if (parsed.name) return parsed.name;

  return JSON.stringify(parsed);
}

function extractUserIDs(item: Item) {
  const ids: number[] = [];

  for (const col of item.column_values || []) {
    if (col.type === 'people') {
      const value = JSON.parse(col.value || "[]");
      for (const person of value.personsAndTeams || []) {
        ids.push(person.id);
      }
    }
  }

  return ids;
}

function buildNotificationMessage(event: Event, item: Item) {
  const [taskName, sourceBoard] = parseItemNameParts(item.name);
  const newName = extractSimpleLabel(event.value);
  const oldName = extractSimpleLabel(event.previousValue);

  switch (event.type) {
    case 'update_name':
      return `✏️ Task "${oldName}" from ${sourceBoard} board was renamed to "${newName}"`;

    case 'update_column_value': {
      const title = event.columnTitle;
      const from = extractSimpleLabel(event.previousValue);
      const to = extractSimpleLabel(event.value);
      if (from && to) {
        return `📌 "${title}" changed from "${from}" to "${to}" on "${taskName}" from "${sourceBoard}"`;
      }
      return `📌 "${title}" updated on "${taskName}"`;
    }

    case 'item_archived':
      return `📦 Task "${taskName}" from ${sourceBoard} board was archived`;

    case 'item_deleted':
      return `❌ Task "${taskName}" from ${sourceBoard} board was deleted`;

    default:
      return `🔔 Task "${taskName}" from ${sourceBoard} board was updated`;
  }
}

async function notifyUsers(userIds: number[], boardId: string, message: string) {
  for (const userId of userIds) {
    await createNotification(userId, boardId, message);
  }
}
