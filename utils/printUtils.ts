/**
 * Utilidad para impresión de Guías de Remisión
 * Genera un HTML autocontenido en una nueva ventana para evitar problemas de estilos
 */
export const printGuiaRemision = (guia: any, items: any[], branchInfo: any) => {
  
  const itemsRows = items.map((item: any, idx: number) => {
    // Manejar diferencias de estructura de datos
    const venta = item.ventas || (Array.isArray(item.items_venta) ? item.items_venta[0]?.ventas : item.items_venta?.ventas);
    const cliente = venta?.clientes || item.cliente_nombre || 'S/N CLIENTE';
    const clienteNombre = typeof cliente === 'object' 
      ? (cliente.nombres || cliente.nombre || cliente.razon_social || 'S/N CLIENTE')
      : cliente;
    
    // 1. Identificar la data de la prenda (puede estar anidada o directa)
    const iv = Array.isArray(item.items_venta) ? item.items_venta[0] : (item.items_venta || item);
    
    // 2. Extraer descripción de prenda
    const prenda = item.nombre_prenda || 
                   item.itemName || 
                   item.name ||
                   iv?.descripcion || 
                   iv?.nombre || 
                   iv?.name ||
                   item.descripcion ||
                   'PRENDA';
    
    // 3. Extraer detalles adicionales
    const color = item.color || iv?.color || item.items_venta?.color || '';
    const marca = item.marca || iv?.marca || item.items_venta?.marca || '';
    const estado = item.estado_prenda || iv?.estado_prenda || item.items_venta?.estado || '';
    const observaciones = item.detalle || item.details || item.observaciones || iv?.observaciones || iv?.details || '';
    
    const ticket = item.ticketNumber || venta?.codigo_orden || item.venta_codigo || '-';

    return `
      <tr>
        <td style="padding:8px 6px; border-bottom:1px solid #eee; text-align:center;">${idx + 1}</td>
        <td style="padding:8px 6px; border-bottom:1px solid #eee; font-weight:bold;">${ticket}</td>
        <td style="padding:8px 6px; border-bottom:1px solid #eee; text-transform:uppercase;">${clienteNombre}</td>
        <td style="padding:8px 6px; border-bottom:1px solid #eee; text-transform:uppercase;">
          <div style="font-weight:bold;">${prenda}</div>
          <div style="font-size:9px; color:#666;">
            ${color ? `<span>COLOR: ${color}</span>` : ''}
            ${marca ? `<span style="margin-left:5px;">MARCA: ${marca}</span>` : ''}
            ${estado ? `<div style="margin-top:2px;">ESTADO: ${estado}</div>` : ''}
            ${observaciones ? `<div style="font-style:italic;">OBS: ${observaciones}</div>` : ''}
          </div>
        </td>
        <td style="padding:8px 6px; border-bottom:1px solid #eee; text-align:right; font-weight:bold;">${item.cantidad || 1}</td>
      </tr>
    `;
  }).join('');

  const fechaEmision = new Date().toLocaleString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  const totalPrendas = items.reduce((acc, item) => acc + (item.cantidad || 1), 0);
  const primaryColor = branchInfo?.color_primario || '#000000';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>GUIA DE TRASLADO - ${guia?.codigo_guia || ''}</title>
      <style>
        @page { margin: 10mm; size: auto; }
        body { font-family: 'Courier New', Courier, monospace; line-height: 1.2; color: #333; margin: 0; padding: 0; font-size: 12px; }
        .container { max-width: 800px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px dashed #ccc; padding-bottom: 15px; margin-bottom: 15px; }
        .title { font-size: 18px; font-weight: bold; margin: 5px 0; text-transform: uppercase; }
        .codigo { font-size: 24px; font-weight: 900; margin: 5px 0; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; font-size: 11px; }
        .info-box { border: 1px solid #eee; padding: 8px; border-radius: 4px; }
        .label { font-weight: bold; text-transform: uppercase; font-size: 9px; color: #777; display: block; margin-bottom: 2px; }
        .value { font-weight: bold; display: block; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #f8f9fa; text-align: left; padding: 8px 6px; font-size: 10px; text-transform: uppercase; border-bottom: 2px solid #333; }
        .total-section { margin-top: 20px; border-top: 2px solid #333; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; }
        .firma-section { margin-top: 50px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
        .firma-box { border-top: 1px solid #333; text-align: center; padding-top: 5px; font-size: 10px; text-transform: uppercase; }
        .footer { text-align: center; margin-top: 30px; font-size: 9px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="title">Guía de Traslado</div>
          <div class="codigo">${guia.codigo_guia}</div>
          <div style="font-size: 10px; margin-top: 5px;">FECHA/HORA: ${fechaEmision}</div>
        </div>

        <div class="info-grid">
          <div class="info-box">
            <span class="label">Origen</span>
            <span class="value">${guia.sucursal_origen?.nombre_sucursal || 'SUCURSAL ORIGEN'}</span>
            <span style="font-size: 9px;">${guia.sucursal_origen?.direccion || ''}</span>
          </div>
          <div class="info-box">
            <span class="label">Destino</span>
            <span class="value">${guia.sucursal_destino?.nombre_sucursal || 'SUCURSAL DESTINO'}</span>
            <span style="font-size: 9px;">${guia.sucursal_destino?.direccion || ''}</span>
          </div>
          <div class="info-box">
            <span class="label">Chofer / Responsable</span>
            <span class="value">${guia.nombre_chofer || guia.chofer?.nombre_completo || 'PERSONAL INTERNO'}</span>
            <span style="font-size: 9px;">PLACA: ${guia.placa_vehiculo || '-'}</span>
          </div>
          <div class="info-box">
            <span class="label">Tipo de Guía / Estado</span>
            <span class="value">${guia.tipo_guia || 'TRASLADO'} - ${guia.estado}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px; text-align:center;">#</th>
              <th style="width: 100px;">Orden</th>
              <th style="width: 150px;">Cliente</th>
              <th>Descripción Prenda</th>
              <th style="width: 50px; text-align:right;">Cant</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div class="total-section">
          <div style="font-size: 11px; font-weight: bold; text-transform: uppercase;">
            Observaciones: ${guia.notas || 'Sin observaciones adicionales.'}
          </div>
          <div style="text-align: right;">
            <span style="font-size: 11px;">TOTAL PRENDAS:</span>
            <div style="font-size: 24px; font-weight: 900;">${totalPrendas}</div>
          </div>
        </div>

        <div class="firma-section">
          <div class="firma-box">
            Despachado por<br><strong>${guia.sucursal_origen?.nombre_sucursal || 'ORIGEN'}</strong>
          </div>
          <div class="firma-box">
            Recibido por / Chofer<br><strong>${guia.nombre_chofer || 'REPRESENTANTE'}</strong>
          </div>
        </div>

        <div class="footer">
          SISLAV PRO V1 - SISTEMA DE GESTIÓN LOGÍSTICA<br>
          Este documento es una guía interna de control de traslado de prendas.
        </div>
      </div>

      <script>
        // Función para verificar si las imágenes (como QR o Logo) cargaron
        function checkImages() {
          const images = document.querySelectorAll('img');
          let loaded = 0;
          if (images.length === 0) return Promise.resolve();
          return new Promise((resolve) => {
            images.forEach(img => {
              if (img.complete) {
                loaded++;
                if (loaded === images.length) resolve();
              } else {
                img.addEventListener('load', () => {
                  loaded++;
                  if (loaded === images.length) resolve();
                });
                img.addEventListener('error', () => {
                  loaded++;
                  if (loaded === images.length) resolve();
                });
              }
            });
            // Timeout de seguridad para imágenes
            setTimeout(resolve, 2000);
          });
        }

        window.onload = () => {
          checkImages().then(() => {
            setTimeout(() => {
              window.print();
              setTimeout(() => {
                window.close();
              }, 1000);
            }, 800);
          });
        };
      </script>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=900,height=800');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  } else {
    alert('Por favor, permita las ventanas emergentes en su navegador para imprimir la guía.');
  }
};
