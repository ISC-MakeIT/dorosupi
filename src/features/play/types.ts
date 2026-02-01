export interface DrawingBlob {
  id: string;
  url: string;
  uploadedAt: string;
  size: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface ControllerPayload {
  raw: string;
  playerId?: string;
  dx?: number;
  dy?: number;
  button?: string;
  step?: number;
  event?: "connect";
  id?: string;
}
