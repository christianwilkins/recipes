CREATE TABLE groceries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 140),
  quantity TEXT NOT NULL DEFAULT '' CHECK(length(quantity) <= 180),
  category TEXT NOT NULL DEFAULT 'Other',
  note TEXT NOT NULL DEFAULT '' CHECK(length(note) <= 600),
  checked INTEGER NOT NULL DEFAULT 0 CHECK(checked IN (0,1)),
  deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN (0,1))
);
CREATE TABLE grocery_sources (
  item_id INTEGER NOT NULL REFERENCES groceries(id),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  amount TEXT NOT NULL,
  PRIMARY KEY(item_id, slug)
);
CREATE TRIGGER grocery_limit BEFORE INSERT ON groceries
WHEN (SELECT COUNT(*) FROM groceries WHERE deleted = 0) >= 300
AND NOT EXISTS (SELECT 1 FROM groceries WHERE item_key = NEW.item_key AND deleted = 0)
BEGIN SELECT RAISE(ABORT, 'list is full'); END;
CREATE TRIGGER grocery_restore_limit BEFORE UPDATE OF deleted ON groceries
WHEN OLD.deleted = 1 AND NEW.deleted = 0
AND (SELECT COUNT(*) FROM groceries WHERE deleted = 0) >= 300
BEGIN SELECT RAISE(ABORT, 'list is full'); END;
