const LOCAL_STORAGE_KEY = "abstract:v1";
let saveTimer = 0;

export type Thought = {
  id: string;
  x: number;
  y: number;
  text: string;
  createdAt: number; // Epoch ms, convert to Date at UI edge
  updatedAt: number;
};

export type Link = {
  fromId: string;
  toId: string;
  dx: number; // dx and dy offset where the drawn link starts from in the "from" thought
  dy: number;
  updatedAt: number;
};

export type Tag = {
  id: string;
  description: string;
  color: string; // hex value
  updatedAt: number;
};

export type Region = {
  id: string;
  tagId: string;
  x: number; // x & y are top left coords
  y: number;
  w: number; // Width
  h: number; // Height
  updatedAt: number;
};

export type Tombstone = {
  key: string;
  deletedAt: number;
};

export type Data = {
  version: 2;
  thoughts: Thought[];
  links: Link[];
  tags: Tag[];
  regions: Region[];
  tombstones: Tombstone[];
};

export const newId = () => crypto.randomUUID();

export const thoughtKey = (id: string) => `thought:${id}`;
export const linkKey = (fromId: string, toId: string) =>
  `link:${fromId}:${toId}`;
export const tagKey = (id: string) => `tag:${id}`;
export const regionKey = (id: string) => `region:${id}`;

const WELCOME = `Welcome to abstract!
Double click in an empty space to create a thought.
Drag a thought around to move it.
Right click a thought to delete it or connect it to a new thought.
Create tags in the tag menu that can be drawn as rectangles in your thought space for organization.
Write the word TODO in a thought and it becomes a task you can track from the checkbox menu.`;

function getSeed(): Data {
  return {
    version: 2,
    thoughts: [
      {
        id: newId(),
        x: 50,
        y: 170,
        text: WELCOME,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
    links: [],
    tags: [],
    regions: [],
    tombstones: [],
  };
}

function isData(d: unknown): d is Data {
  return (
    typeof d === "object" &&
    d !== null &&
    (d as Data).version === 2 &&
    Array.isArray((d as Data).thoughts) &&
    Array.isArray((d as Data).links) &&
    Array.isArray((d as Data).tags) &&
    Array.isArray((d as Data).regions) &&
    Array.isArray((d as Data).tombstones)
  );
}

export function loadData(): Data {
  try {
    const d: unknown = JSON.parse(
      localStorage.getItem(LOCAL_STORAGE_KEY) ?? "",
    );
    if (isData(d)) return d;
  } catch {}
  return getSeed();
}

export function saveData(d: Data) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(d));
    } catch (e) {
      console.error("store: save failed", e);
    }
  }, 150);
}

export function exportJson(d: Data) {
  return JSON.stringify(d, null, 1);
}

export function importJson(raw: string): Data | null {
  try {
    const dataObject: unknown = JSON.parse(raw);
    if (!isData(dataObject)) {
      console.error("store: import failed (malformed data)");
      return null;
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, raw);
    return dataObject;
  } catch (e) {
    console.error("store: import failed", e);
    return null;
  }
}
