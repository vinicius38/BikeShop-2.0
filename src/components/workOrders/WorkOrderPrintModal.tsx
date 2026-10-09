import React, { useEffect, useState } from 'react';
import { X, Printer } from 'lucide-react';
import { Modal } from '../common/Modal';
import { WorkOrder, Customer, Bicycle } from '../../types/api';
import { useWorkshop } from '../../context/WorkshopContext';
import { getWorkOrderStatusLabel } from '../../utils/statusUtils';
import { customerService } from '../../services/customerService';
import { bicycleService } from '../../services/bicycleService';
import { workOrderService } from '../../services/workOrderService';
import { toBlob } from 'html-to-image';

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
  </svg>
);

interface WorkOrderPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrder: WorkOrder | null;
}

export const WorkOrderPrintModal: React.FC<WorkOrderPrintModalProps> = ({
  isOpen,
  onClose,
  workOrder,
}) => {
  const { settings, logoUrl, workshopName, tradeName } = useWorkshop();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [bicycle, setBicycle] = useState<Bicycle | null>(null);
  const [fullWorkOrder, setFullWorkOrder] = useState<WorkOrder | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (isOpen && workOrder?.id) {
      workOrderService.getById(workOrder.id).then(res => {
        setFullWorkOrder(res);
        if (res.customerId) {
          customerService.getById(res.customerId).then(c => setCustomer(c)).catch(console.error);
        }
        if (res.bicycleId) {
          bicycleService.getById(res.bicycleId).then(b => setBicycle(b)).catch(console.error);
        }
      }).catch(console.error);
    } else {
      setFullWorkOrder(null);
      setCustomer(null);
      setBicycle(null);
    }
  }, [isOpen, workOrder]);

  const displayWorkOrder = fullWorkOrder || workOrder;

  if (!isOpen || !displayWorkOrder) return null;

  const handlePrint = () => {
    window.print();
  };

  const services = (displayWorkOrder.items || []).filter(
    (i) => i.itemType === 'Service' || (i as any).itemTypeName === 'Service' || (i as any).itemType === 2
  );
  const products = (displayWorkOrder.items || []).filter(
    (i) => i.itemType === 'Product' || (i as any).itemTypeName === 'Product' || (i as any).itemType === 1
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Impressão de Ordem de Serviço"
      subtitle="Visualização do documento com cabeçalho oficial e campos de assinatura"
      maxWidth="4xl"
    >
      <div className="space-y-4">
        {/* Print trigger button at top */}
        <div className="flex justify-end gap-2 no-print">
          <button
            onClick={async () => {
              setIsGenerating(true);
              try {
                const element = document.getElementById('printable-work-order');
                if (!element) return;
                
                // For a good quality snapshot without borders
                element.classList.remove('rounded-xl', 'shadow-lg', 'border', 'border-slate-200');
                element.style.padding = '32px';

                const blob = await toBlob(element, { backgroundColor: '#ffffff', pixelRatio: 2 });
                
                // Re-apply original classes
                element.classList.add('rounded-xl', 'shadow-lg', 'border', 'border-slate-200');
                element.style.padding = '';

                if (!blob) throw new Error('Falha ao gerar o arquivo de imagem.');

                // 1. Tenta baixar a imagem como backup infalível
                try {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `OS_${displayWorkOrder.number}.png`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                } catch (e) {
                  console.error('Download failed', e);
                }

                let finalCustomer = customer;
                if (!finalCustomer && displayWorkOrder.customerId) {
                  try {
                    // Try to fetch synchronously to ensure we have the phone
                    const { customerService } = await import('../../services/customerService');
                    finalCustomer = await customerService.getById(displayWorkOrder.customerId);
                  } catch (e) {
                    console.error('Failed to fetch customer for phone fallback', e);
                  }
                }

                const rawPhone = displayWorkOrder.customerPhone || finalCustomer?.cellPhone || finalCustomer?.phone || '';
                const phoneDigits = rawPhone.replace(/\D/g, '');
                const finalPhone = phoneDigits ? (phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`) : '';
                
                const text = `Olá ${displayWorkOrder.customerName || finalCustomer?.name || 'Cliente'},\nAqui está a sua Ordem de Serviço.`;
                const whatsappUrl = finalPhone 
                  ? `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(text)}` 
                  : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

                // 2. Copia para a área de transferência e abre o WhatsApp
                try {
                  if (typeof ClipboardItem !== 'undefined') {
                    await navigator.clipboard.write([
                      new ClipboardItem({ 'image/png': blob })
                    ]);
                  }
                } catch (clipboardErr) {
                  console.error('Clipboard failed', clipboardErr);
                  alert('Seu navegador bloqueou a cópia automática. Use a imagem que acabou de ser baixada e envie no WhatsApp.');
                }
                
                window.open(whatsappUrl, '_blank');
              } catch (error: any) {
                console.error('Error generating image', error);
                alert('Erro ao gerar imagem: ' + (error?.message || error));
              } finally {
                setIsGenerating(false);
              }
            }}
            disabled={isGenerating}
            className="px-4 py-2 bg-[#22C55E] hover:bg-[#22C55E]/90 disabled:opacity-50 text-white font-bold text-xs rounded-lg flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
          >
            <WhatsAppIcon className="w-4 h-4" />
            {isGenerating ? 'Gerando...' : 'Enviar OS (WhatsApp)'}
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-[#EF7410] hover:bg-[#EF7410]/90 text-white font-bold text-xs rounded-lg flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Imprimir Documento
          </button>
        </div>

        {/* Printable Paper Canvas (Styled for high legibility, white print preview) */}
        <div
          id="printable-work-order"
          className="bg-white text-slate-900 p-8 print:p-4 rounded-xl print:rounded-none shadow-lg print:shadow-none font-sans border border-slate-200 print:border-none text-xs print-area"
        >
          {/* Company Header */}
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4 mb-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-md bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden">
                <img
                  src={logoUrl}
                  alt={workshopName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight text-slate-950 uppercase">
                  {workshopName}
                </h1>
                {tradeName && tradeName.toLowerCase() !== workshopName.toLowerCase() && (
                  <p className="text-xs text-slate-600 font-medium">{tradeName}</p>
                )}
                <p className="text-[11px] text-slate-500 font-mono">
                  CNPJ: {settings?.formattedCpfCnpj || settings?.cpfCnpj || '12.345.678/0001-99'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {settings?.address?.formattedAddressLine ||
                    'Passos - MG / São Paulo - SP'}
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xl font-extrabold font-mono text-[#EF7410]">
                {displayWorkOrder.number}
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Data: {new Date(displayWorkOrder.openingDate).toLocaleDateString('pt-BR')}
              </p>
              <p className="text-xs text-slate-600">
                Status: <strong className="uppercase">{getWorkOrderStatusLabel(displayWorkOrder.statusName || displayWorkOrder.status)}</strong>
              </p>
              <p className="text-[11px] text-slate-500 font-mono mt-1">
                Tel: {settings?.formattedPhone || settings?.phone || '(11) 3456-7890'}
              </p>
            </div>
          </div>

          {/* Customer & Bike Info Grid */}
          <div className="grid grid-cols-2 gap-4 border border-slate-300 rounded-lg p-3 mb-4 bg-slate-50">
            <div>
              <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider mb-1">
                Dados do Cliente
              </span>
              <p className="font-semibold text-slate-950 text-sm mb-1">{customer?.name || displayWorkOrder.customerName || 'Consumidor Final'}</p>
              <div className="text-[11px] text-slate-700 space-y-0.5">
                {customer?.cpfCnpj && <p><strong>CPF/CNPJ:</strong> {customer.cpfCnpj}</p>}
                {(displayWorkOrder.customerPhone || customer?.phone || customer?.cellPhone) && (
                  <p><strong>Telefone:</strong> {displayWorkOrder.customerPhone || customer?.cellPhone || customer?.phone}</p>
                )}
                {customer?.email && <p><strong>E-mail:</strong> {customer.email}</p>}
                {customer?.address && (
                  <p>
                    <strong>Endereço:</strong> {customer.address.street}, {customer.address.number}
                    {customer.address.complement && ` - ${customer.address.complement}`}
                    {customer.address.neighborhood && ` - ${customer.address.neighborhood}`}
                    {customer.address.city && ` - ${customer.address.city}/${customer.address.state}`}
                  </p>
                )}
              </div>
            </div>
            <div>
              <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider mb-1">
                Dados da Bicicleta
              </span>
              <p className="font-semibold text-slate-950 text-sm mb-1">
                {bicycle?.brand || displayWorkOrder.bicycleBrand}
              </p>
              <div className="text-[11px] text-slate-700 space-y-0.5">
                {(bicycle?.color) && <p><strong>Cor:</strong> {bicycle.color}</p>}
                <p className="font-mono"><strong>Nº de Série:</strong> {bicycle?.serialNumber || displayWorkOrder.bicycleSerialNumber || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Problem & Diagnosis */}
          <div className="border border-slate-300 rounded-lg p-3 mb-4">
            <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider mb-1">
              Reclamação & Diagnóstico Técnico
            </span>
            <p className="text-slate-700 leading-relaxed mb-2">
              <strong>Problema Relatado:</strong> {displayWorkOrder.description || displayWorkOrder.customerComplaint || 'Revisão periódica geral.'}
            </p>
            {displayWorkOrder.technicalEvaluation && (
              <p className="text-slate-700 leading-relaxed">
                <strong>Parecer Técnico:</strong> {displayWorkOrder.technicalEvaluation}
              </p>
            )}
          </div>

          {/* Services Table */}
          {services.length > 0 && (
            <div className="mb-4">
              <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider mb-1">
                Serviços Executados
              </span>
              <table className="w-full border-collapse border border-slate-300 text-[11px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-700">
                    <th className="border border-slate-300 p-1.5 text-left">Descrição do Serviço</th>
                    <th className="border border-slate-300 p-1.5 text-center w-16">Qtd</th>
                    <th className="border border-slate-300 p-1.5 text-right w-24">Valor Unit.</th>
                    <th className="border border-slate-300 p-1.5 text-right w-24">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((s) => (
                    <tr key={s.id}>
                      <td className="border border-slate-300 p-1.5 font-medium">
                        {s.description || s.serviceName || 'Serviço executado'}
                      </td>
                      <td className="border border-slate-300 p-1.5 text-center font-mono">{s.quantity}</td>
                      <td className="border border-slate-300 p-1.5 text-right font-mono">
                        R$ {Number(s.unitPrice).toFixed(2)}
                      </td>
                      <td className="border border-slate-300 p-1.5 text-right font-mono font-medium">
                        R$ {(s.unitPrice * s.quantity).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Products Table */}
          {products.length > 0 && (
            <div className="mb-4">
              <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider mb-1">
                Peças & Acessórios Aplicados
              </span>
              <table className="w-full border-collapse border border-slate-300 text-[11px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-700">
                    <th className="border border-slate-300 p-1.5 text-left">Peça / Produto</th>
                    <th className="border border-slate-300 p-1.5 text-center w-16">Qtd</th>
                    <th className="border border-slate-300 p-1.5 text-right w-24">Valor Unit.</th>
                    <th className="border border-slate-300 p-1.5 text-right w-24">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td className="border border-slate-300 p-1.5 font-medium">
                        <span>{p.description || p.productName || 'Peça / Componente'}</span>
                        {p.productSku && (
                          <span className="text-[10px] text-slate-500 font-mono ml-1.5">
                            (SKU: {p.productSku})
                          </span>
                        )}
                      </td>
                      <td className="border border-slate-300 p-1.5 text-center font-mono">{p.quantity}</td>
                      <td className="border border-slate-300 p-1.5 text-right font-mono">
                        R$ {Number(p.unitPrice).toFixed(2)}
                      </td>
                      <td className="border border-slate-300 p-1.5 text-right font-mono font-medium">
                        R$ {(p.unitPrice * p.quantity).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Totals Summary */}
          <div className="flex justify-end mb-6">
            <div className="w-64 border border-slate-300 rounded-lg p-2.5 bg-slate-50 space-y-1 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal Itens:</span>
                <span className="font-mono">R$ {Number(displayWorkOrder.subtotal || 0).toFixed(2)}</span>
              </div>
              {displayWorkOrder.discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Desconto:</span>
                  <span className="font-mono">- R$ {Number(displayWorkOrder.discount || 0).toFixed(2)}</span>
                </div>
              )}
              {displayWorkOrder.additionalCharge > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>Acréscimo:</span>
                  <span className="font-mono">+ R$ {Number(displayWorkOrder.additionalCharge || 0).toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-slate-300 pt-1 flex justify-between font-bold text-slate-950 text-sm">
                <span>TOTAL OS:</span>
                <span className="font-mono text-[#EF7410]">R$ {Number(displayWorkOrder.total || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <p className="text-[10px] text-slate-500 text-center italic mb-8">
            {settings?.footerMessage ||
              'Nilson Bikes - Performance, Tecnologia e Mobilidade com máxima precisão técnica!'}
          </p>

          {/* Signature lines */}
          <div className="grid grid-cols-2 gap-12 pt-4 border-t border-slate-300 text-center text-xs">
            <div>
              <div className="border-b border-slate-400 mb-1 w-3/4 mx-auto" />
              <p className="font-semibold text-slate-900">{workshopName}</p>
              <p className="text-[10px] text-slate-500">Técnico Responsável</p>
            </div>
            <div>
              <div className="border-b border-slate-400 mb-1 w-3/4 mx-auto" />
              <p className="font-semibold text-slate-900">{customer?.name || displayWorkOrder.customerName || 'Consumidor Final'}</p>
              <p className="text-[10px] text-slate-500">Assinatura do Cliente</p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
