import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

// Estenda o dayjs com plugins
dayjs.extend(utc);
dayjs.extend(timezone);

// Defina o fuso horário padrão
const TIMEZONE = process.env.TIMEZONE || 'America/Sao_Paulo';
dayjs.tz.setDefault(TIMEZONE);

// Inicialize o cliente do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Mapeamento de dias da semana para números (0 = domingo, 1 = segunda, ..., 6 = sábado)
const daysOfWeek = {
  'domingo': 0,
  'segunda-feira': 1, 'segunda': 1,
  'terça-feira': 2, 'terça': 2,
  'quarta-feira': 3, 'quarta': 3,
  'quinta-feira': 4, 'quinta': 4,
  'sexta-feira': 5, 'sexta': 5,
  'sábado': 6, 'sabado': 6
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Método ${req.method} não permitido` });
  }

  const { mensagem } = req.body;
  if (!mensagem) {
    return res.status(400).json({ error: 'Mensagem é obrigatória' });
  }

  // Crie uma data de referência no fuso horário local
  const referenceDate = dayjs().tz(TIMEZONE);
  console.log('Data de referência:', referenceDate.format('DD/MM/YYYY'));

  // Inicialize targetDate com a data atual
  let targetDate = dayjs(referenceDate).tz(TIMEZONE);
  console.log('Data inicial (targetDate):', targetDate.format('DD/MM/YYYY'));

  // Ajuste manual para variações de tempo
  const lowerMessage = mensagem.toLowerCase();
  console.log('Valor de lowerMessage:', JSON.stringify(lowerMessage));
  console.log('Caracteres de lowerMessage (ASCII):', lowerMessage.split('').map(char => char.charCodeAt(0)));
  let dateAdjusted = false;
  let nextMonthDetected = false;
  let nextYearDetected = false;

  // Verificar "no próximo ano"
  if (lowerMessage.includes('no próximo ano') || lowerMessage.includes('no proximo ano') || lowerMessage.includes('próximo ano') || lowerMessage.includes('proximo ano')) {
    nextYearDetected = true;
  }

  // Verificar "no próximo mês"
  if (lowerMessage.includes('no próximo mês') || lowerMessage.includes('no proximo mes') || lowerMessage.includes('próximo mês') || lowerMessage.includes('proximo mes')) {
    nextMonthDetected = true;
  }

  // Verificar "dia X" (ex.: dia 24)
  const dayMatch = lowerMessage.match(/dia\s+(\d{1,2})/);
  if (dayMatch) {
    const dayOfMonth = parseInt(dayMatch[1], 10);
    if (dayOfMonth < 1 || dayOfMonth > 31) {
      return res.status(400).json({ error: 'Dia inválido. Use um valor entre 1 e 31.' });
    }
    const currentDay = targetDate.date();
    const currentMonth = targetDate.month();
    const currentYear = targetDate.year();
    if (nextYearDetected) {
      targetDate = targetDate.year(currentYear + 1).month(currentMonth).date(dayOfMonth);
      if (targetDate.date() !== dayOfMonth) {
        targetDate = targetDate.endOf('month');
      }
    } else if (nextMonthDetected) {
      targetDate = targetDate.month(currentMonth + 1).date(dayOfMonth);
      if (targetDate.date() !== dayOfMonth) {
        targetDate = targetDate.endOf('month');
      }
      if (targetDate.month() < currentMonth) {
        targetDate = targetDate.year(currentYear + 1);
      }
    } else {
      if (dayOfMonth >= currentDay) {
        targetDate = targetDate.date(dayOfMonth);
      } else {
        targetDate = targetDate.month(currentMonth + 1).date(dayOfMonth);
        if (targetDate.month() < currentMonth) {
          targetDate = targetDate.year(currentYear + 1).month(currentMonth + 1).date(dayOfMonth);
        }
      }
    }
    console.log('Após "dia X":', targetDate.format('DD/MM/YYYY'));
    dateAdjusted = true;
  }

  // Verificar "daqui a X dias"
  const daquiMatch = lowerMessage.match(/daqui\s+a\s+(\d{1,2})\s+dias/);
  if (daquiMatch && !dateAdjusted) {
    const daysToAdd = parseInt(daquiMatch[1], 10);
    if (daysToAdd < 1) {
      return res.status(400).json({ error: 'Número de dias inválido. Use um valor maior que 0.' });
    }
    targetDate = targetDate.add(daysToAdd, 'day');
    console.log('Após "daqui a X dias":', targetDate.format('DD/MM/YYYY'));
    dateAdjusted = true;
  }

  // Verificar dias da semana (ex.: "segunda-feira no próximo ano")
  let targetDayOfWeek = -1;
  let isNextWeekDay = false;
  let isWeekAfter = false;
  for (const [dayName, dayNumber] of Object.entries(daysOfWeek)) {
    if (lowerMessage.includes(dayName + ' da semana que vem') || lowerMessage.includes(dayName + ' da próxima semana') || lowerMessage.includes(dayName + ' da proxima semana')) {
      targetDayOfWeek = dayNumber;
      isWeekAfter = true;
      break;
    } else if (lowerMessage.includes('próxima ' + dayName) || lowerMessage.includes('proxima ' + dayName)) {
      targetDayOfWeek = dayNumber;
      isNextWeekDay = true;
      break;
    } else if (lowerMessage.includes(dayName)) {
      targetDayOfWeek = dayNumber;
      break;
    }
  }

  if (targetDayOfWeek !== -1 && !dateAdjusted) {
    const currentDayOfWeek = targetDate.day();
    let daysToAdd;
    if (nextYearDetected) {
      const currentMonth = targetDate.month();
      const currentYear = targetDate.year();
      targetDate = targetDate.year(currentYear + 1).month(currentMonth).date(1);
      const firstDayOfNextYearMonth = targetDate.day();
      daysToAdd = targetDayOfWeek - firstDayOfNextYearMonth;
      if (daysToAdd < 0) {
        daysToAdd += 7;
      }
      targetDate = targetDate.add(daysToAdd, 'day');
      if (targetDate.date() !== targetDate.date()) {
        targetDate = targetDate.endOf('month');
      }
    } else if (nextMonthDetected) {
      const currentMonth = targetDate.month();
      const currentYear = targetDate.year();
      targetDate = targetDate.month(currentMonth + 1).date(1);
      if (targetDate.month() < currentMonth) {
        targetDate = targetDate.year(currentYear + 1);
      }
      const firstDayOfNextMonth = targetDate.day();
      daysToAdd = targetDayOfWeek - firstDayOfNextMonth;
      if (daysToAdd < 0) {
        daysToAdd += 7;
      }
      targetDate = targetDate.add(daysToAdd, 'day');
      if (targetDate.date() !== targetDate.date()) {
        targetDate = targetDate.endOf('month');
      }
    } else if (isWeekAfter) {
      targetDate = targetDate.add(7, 'day');
      const newCurrentDayOfWeek = targetDate.day();
      daysToAdd = targetDayOfWeek - newCurrentDayOfWeek;
      if (targetDayOfWeek === currentDayOfWeek) {
        daysToAdd = 0;
      } else if (daysToAdd < 0) {
        daysToAdd += 7;
      }
      targetDate = targetDate.add(daysToAdd, 'day');
    } else {
      daysToAdd = targetDayOfWeek - currentDayOfWeek;
      if (daysToAdd <= 0 || isNextWeekDay) {
        daysToAdd += 7;
      }
      targetDate = targetDate.add(daysToAdd, 'day');
    }
    console.log('Após "dia da semana":', targetDate.format('DD/MM/YYYY'));
    dateAdjusted = true;
  }

  // Verificar "semana que vem" ou "próxima semana" (sem dia da semana específico)
  if ((lowerMessage.includes('semana que vem') || lowerMessage.includes('próxima semana') || lowerMessage.includes('proxima semana')) &&
      !Object.keys(daysOfWeek).some(day => lowerMessage.includes(day + ' da semana que vem') || lowerMessage.includes(day + ' da próxima semana') || lowerMessage.includes(day + ' da proxima semana')) &&
      !dateAdjusted) {
    targetDate = targetDate.add(7, 'day');
    console.log('Após "semana que vem":', targetDate.format('DD/MM/YYYY'));
    dateAdjusted = true;
  }

  // Verificar "no próximo mês" (sem dia ou dia da semana específico)
  if (nextMonthDetected && !dateAdjusted) {
    const currentDay = targetDate.date();
    const currentMonth = targetDate.month();
    const currentYear = targetDate.year();
    targetDate = targetDate.month(currentMonth + 1).date(currentDay);
    if (targetDate.date() !== currentDay) {
      targetDate = targetDate.endOf('month');
    }
    if (targetDate.month() < currentMonth) {
      targetDate = targetDate.year(currentYear + 1);
    }
    console.log('Após "no próximo mês":', targetDate.format('DD/MM/YYYY'));
    dateAdjusted = true;
  }

  // Verificar "no próximo ano" (sem dia ou dia da semana específico)
  if (nextYearDetected && !dateAdjusted) {
    const currentDay = targetDate.date();
    const currentMonth = targetDate.month();
    const currentYear = targetDate.year();
    targetDate = targetDate.year(currentYear + 1).month(currentMonth).date(currentDay);
    if (targetDate.date() !== currentDay) {
      targetDate = targetDate.endOf('month');
    }
    console.log('Após "no próximo ano":', targetDate.format('DD/MM/YYYY'));
    dateAdjusted = true;
  }

  // Verificar "hoje", "amanhã", "depois de amanhã" com verificações mais estritas
  if (lowerMessage.includes('hoje') && !dateAdjusted) {
    console.log('Após "hoje":', targetDate.format('DD/MM/YYYY'));
    dateAdjusted = true;
  } else if ((lowerMessage.includes('depois de amanha') || lowerMessage.includes('depois de amanhã')) && !dateAdjusted) {
    targetDate = targetDate.add(2, 'day');
    console.log('Após "depois de amanhã":', targetDate.format('DD/MM/YYYY'));
    dateAdjusted = true;
  } else if ((lowerMessage.normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes('amanha') || lowerMessage.includes('amanhã') || lowerMessage.includes('amanha')) && !dateAdjusted) {
    targetDate = targetDate.add(1, 'day');
    console.log('Após "amanhã":', targetDate.format('DD/MM/YYYY'));
    dateAdjusted = true;
  }

  // Ajuste manual se a data específica estiver na mensagem
  const dateMatch = mensagem.match(/\d{2}\/\d{2}\/\d{4}/);
  if (dateMatch) {
    const [day, month, year] = dateMatch[0].split('/');
    const parsedDay = parseInt(day);
    const parsedMonth = parseInt(month) - 1;
    const parsedYear = parseInt(year);
    if (parsedDay < 1 || parsedDay > 31 || parsedMonth < 0 || parsedMonth > 11 || parsedYear < 2000) {
      return res.status(400).json({ error: 'Data inválida. Use o formato DD/MM/YYYY com valores válidos.' });
    }
    targetDate = targetDate.year(parsedYear).month(parsedMonth).date(parsedDay);
    console.log('Após "data específica":', targetDate.format('DD/MM/YYYY'));
    dateAdjusted = true;
  }

  // Evitar o fallback se já ajustamos a data manualmente
  if (!dateAdjusted) {
    return res.status(400).json({ error: 'Data não encontrada ou não reconhecida na mensagem.' });
  }

  // Extraia a hora manualmente usando regex (aceitando "às HHh" ou "às HH:MM")
  const timeMatch = mensagem.match(/às\s*(\d{1,2})(?::(\d{2}))?(?:\s*h)?/i);
  let hour = 0;
  let minute = 0;
  if (timeMatch) {
    hour = parseInt(timeMatch[1], 10);
    minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    if (hour === 12 && lowerMessage.includes('am')) hour = 0;
    if (hour < 12 && lowerMessage.includes('pm')) hour += 12;
    if (hour > 23 || minute > 59) {
      return res.status(400).json({ error: 'Hora inválida. Use um valor entre 0 e 23 para horas e 0 a 59 para minutos.' });
    }
  } else {
    return res.status(400).json({ error: 'Hora não encontrada na mensagem. Use o formato "às HHh" ou "às HH:MM".' });
  }

  // Aplique a hora e minuto manualmente
  targetDate = targetDate.hour(hour).minute(minute).second(0);
  console.log('Após ajuste de hora:', targetDate.format('DD/MM/YYYY HH:mm'));

  // Converta para Date para o Supabase
  const dataHora = targetDate.toDate();

  // Extraia o título
  let title = mensagem;
  console.log('Título inicial:', JSON.stringify(title));
  title = title.replace(/\d{2}\/\d{2}\/\d{4}/gi, '').trim();
  console.log('Após remover data (DD/MM/YYYY):', JSON.stringify(title));
  title = title.replace(/às\s*\d{1,2}(?::\d{2})?(?:\s*h)?/gi, '').replace(/às/gi, '').trim();
  console.log('Após remover hora:', JSON.stringify(title));
  title = title.replace(/hoje|amanha|amanhã|depois de amanha|depois de amanhã|semana que vem|próxima semana|proxima semana/gi, '').trim();
  console.log('Após remover palavras de tempo:', JSON.stringify(title));
  for (const dayName of Object.keys(daysOfWeek)) {
    title = title.replace(new RegExp(`próxima ${dayName}|proxima ${dayName}|${dayName} da semana que vem|${dayName} da próxima semana|${dayName} da proxima semana|${dayName}`, 'gi'), '').trim();
  }
  console.log('Após remover dias da semana:', JSON.stringify(title));
  title = title.replace(/dia\s+\d{1,2}/gi, '').trim();
  console.log('Após remover "dia X":', JSON.stringify(title));
  title = title.replace(/daqui\s+a\s+\d{1,2}\s+dias/gi, '').trim();
  console.log('Após remover "daqui a X dias":', JSON.stringify(title));
  title = title.replace(/no\s+próximo\s+mês|no\s+proximo\s+mes|próximo\s+mês|proximo\s+mes/gi, '').trim();
  console.log('Após remover "no próximo mês":', JSON.stringify(title));
  title = title.replace(/no\s+próximo\s+ano|no\s+proximo\s+ano|próximo\s+ano|proximo\s+ano/gi, '').trim();
  console.log('Após remover "no próximo ano":', JSON.stringify(title));
  title = title.replace(/Compromisso marcado:/gi, '').trim();
  console.log('Após remover "Compromisso marcado":', JSON.stringify(title));
  const verbs = ['marque', 'marca', 'anote', 'anota', 'agende', 'agenda'];
  for (const verb of verbs) {
    if (title.toLowerCase() === verb || title.toLowerCase().startsWith(verb + ' ')) {
      if (title.toLowerCase() === verb) {
        title = '';
      } else {
        title = title.substring(verb.length + 1).trim();
      }
      break;
    }
  }
  console.log('Após remover verbo inicial:', JSON.stringify(title));
  title = title.replace(/^\s*uma?\s+/i, '').trim();
  console.log('Após remover "uma"/"um":', JSON.stringify(title));
  title = title.replace(/\b(da|de)\b/gi, '').trim();
  console.log('Após remover "da"/"de":', JSON.stringify(title));
  title = title.replace(/\s+/g, ' ').trim();
  console.log('Título final após extração:', JSON.stringify(title));
  console.log('Comprimento do título:', title.length);
  console.log('Caracteres do título (ASCII):', title.split('').map(char => char.charCodeAt(0)));

  // Validação do título
  console.log('Iniciando validação do título...');
  if (!title || title.trim().length === 0) {
    console.log('Título é vazio ou contém apenas espaços');
    console.log('Retornando erro 400...');
    return res.status(400).json({ error: 'Título do compromisso não pode ser vazio.' });
  }
  console.log('Título é válido, prosseguindo com o salvamento...');

  // Insira o registro no Supabase
  console.log('Salvando no Supabase...');
  const { data, error } = await supabase
    .from('appointments')
    .insert([{ titulo: title, data_hora: dataHora, status: 'marcado' }])
    .select()
    .single();

  if (error) {
    console.log('Erro ao salvar no Supabase:', error.message);
    return res.status(500).json({ error: `Erro ao salvar no banco de dados: ${error.message}` });
  }

  // Formate a data para a resposta
  const formattedDate = dayjs(dataHora).tz(TIMEZONE).format('DD/MM/YYYY [às] HH:mm');

  console.log('Retornando resposta 200...');
  return res.status(200).json({ mensagem: `Compromisso marcado: ${title} em ${formattedDate}` });
}