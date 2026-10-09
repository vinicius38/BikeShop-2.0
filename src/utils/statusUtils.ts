export const WORK_ORDER_STATUS_LABELS: Record<string, string> = {
  Open: 'Aberta',
  WaitingApproval: 'Aguardando Aprovação',
  Approved: 'Aprovada',
  InProgress: 'Em Andamento',
  WaitingParts: 'Aguardando Peças',
  Ready: 'Pronta',
  Delivered: 'Entregue',
  Cancelled: 'Cancelada',
};

export const getWorkOrderStatusLabel = (status?: string | null): string => {
  if (!status) return '';
  return WORK_ORDER_STATUS_LABELS[status] || status;
};

export const SALE_STATUS_LABELS: Record<string, string> = {
  Open: 'Em Aberto',
  Completed: 'Concluída',
  Cancelled: 'Cancelada',
  // Numeric fallbacks if backend returns enum integer values
  '0': 'Em Aberto',
  '1': 'Aguardando Pagamento', // or similar if 1 is used
  '2': 'Concluída',
  '3': 'Cancelada',
};

export const getSaleStatusLabel = (status?: string | number | null): string => {
  if (status === undefined || status === null) return '';
  const statusStr = status.toString();
  return SALE_STATUS_LABELS[statusStr] || statusStr;
};
