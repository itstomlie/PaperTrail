-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "customFieldTemplates" TEXT NOT NULL DEFAULT '[]',
    "citationStyle" TEXT NOT NULL DEFAULT 'bibtex',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Project" ("createdAt", "customFieldTemplates", "description", "id", "name", "sortOrder", "updatedAt") SELECT "createdAt", "customFieldTemplates", "description", "id", "name", "sortOrder", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE TABLE "new_ProjectResource" (
    "projectId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("projectId", "resourceId"),
    CONSTRAINT "ProjectResource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectResource_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProjectResource" ("projectId", "resourceId") SELECT "projectId", "resourceId" FROM "ProjectResource";
DROP TABLE "ProjectResource";
ALTER TABLE "new_ProjectResource" RENAME TO "ProjectResource";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
