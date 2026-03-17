export interface Tag {
  id: string;
  name: string;
  color: string | null;
}

export interface ResourceItem {
  id: string;
  resourceType: string;
  title: string;
  url: string | null;
  notes?: string | null;
  typeFields: string;
  tags: Tag[];
  customFields: Record<string, unknown>;
  createdAt: string | Date;
  status: string;
  starred?: boolean;
}
