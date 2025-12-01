export interface MessageTemplate {
  id: string;
  title: string;
  message: string;
  category: "saudacao" | "lembrete" | "promocao" | "agradecimento" | "opt-in" | "aniversario" | "comemorativo" | "personalizado";
  isCustom: boolean;
  createdAt?: string;
}

export const getDefaultTemplates = (): MessageTemplate[] => [
  {
    id: "opt-in-completo",
    title: "Opt-in - Confirmação de Interesse Completa",
    message: `Olá {nome}! 👋

Espero que esteja tudo bem com você!

Estamos atualizando nossa lista de contatos e gostaríamos de saber se você deseja continuar recebendo nossas mensagens e novidades.

Por favor, responda:
✅ SIM - para continuar recebendo
👉 SAIR - para não receber mais

Obrigado pela atenção! 🙏`,
    category: "opt-in",
    isCustom: false,
  },
  {
    id: "opt-in-simplificado",
    title: "Opt-in - Confirmação Simplificada",
    message: "Oi {nome}! Você gostaria de continuar recebendo nossas mensagens? Responda **SIM** para continuar ou **SAIR** para não receber mais. Obrigado!",
    category: "opt-in",
    isCustom: false,
  },
  {
    id: "confirmacao-interesse",
    title: "Confirmação de Interesse",
    message: "{nome}, confirmamos que você deseja receber nossas atualizações? Digite **SIM** para confirmar ou **SAIR** para cancelar.",
    category: "opt-in",
    isCustom: false,
  },
  {
    id: "rodape-opt-out",
    title: "Rodapé de Mensagem - Opt-out",
    message: "Caso não queira mais receber nossas mensagens, responda com a palavra **SAIR**.",
    category: "opt-in",
    isCustom: false,
  },
  {
    id: "saudacao-formal",
    title: "Saudação Formal",
    message: "Olá {nome}, tudo bem? Espero que esteja tendo um ótimo dia!",
    category: "saudacao",
    isCustom: false,
  },
  {
    id: "saudacao-informal",
    title: "Saudação Informal",
    message: "Oi {nome}! 😊 Como você está?",
    category: "saudacao",
    isCustom: false,
  },
  {
    id: "lembrete-agendamento",
    title: "Lembrete de Agendamento",
    message: "Olá {nome}! Este é um lembrete sobre seu agendamento. Por favor, confirme sua presença. Obrigado!",
    category: "lembrete",
    isCustom: false,
  },
  {
    id: "promocao-oferta",
    title: "Promoção/Oferta",
    message: "🎁 {nome}, temos uma oferta especial para você! Aproveite nossos descontos exclusivos.",
    category: "promocao",
    isCustom: false,
  },
  {
    id: "agradecimento",
    title: "Agradecimento",
    message: "Muito obrigado {nome}! Sua confiança é muito importante para nós. 💚",
    category: "agradecimento",
    isCustom: false,
  },
  {
    id: "aniversario-curta",
    title: "Aniversário - Curta e Festiva",
    message: `🎉 Parabéns, {nome}! 🎉

Hoje é o seu dia de brilhar! A equipe deseja a você um feliz aniversário, repleto de alegria, sucesso e muita paz. 
Que a vida continue te presenteando com momentos maravilhosos!

Abraços,
Equipe`,
    category: "aniversario",
    isCustom: false,
  },
  {
    id: "aniversario-elaborada",
    title: "Aniversário - Desejos de Sucesso",
    message: `Olá, {nome}!

Neste dia especial, queremos parar tudo para celebrar a pessoa incrível que você é. 🥳
Desejamos que o seu novo ciclo seja de muita saúde, realizações e que você alcance todos os seus objetivos. 

Feliz Aniversário!
Com carinho,
Equipe`,
    category: "aniversario",
    isCustom: false,
  },
  {
    id: "aniversario-afetuosa",
    title: "Aniversário - Mensagem Afetuosa",
    message: `Eeei, {nome}! Hoje o dia é todinho seu! 🎈

Passando para te desejar um Feliz Aniversário espetacular! Que a felicidade te encontre em cada momento e que a jornada pela frente seja cheia de luz, amor e muitas alegrias.

Que a sua vida seja sempre de festa!
Um abraço apertado,
Equipe`,
    category: "aniversario",
    isCustom: false,
  },
  {
    id: "natal-calorosa",
    title: "Feliz Natal - Calorosa",
    message: `🎄 Feliz Natal, {nome}! 🎄

Que neste Natal a paz, o amor e a alegria preencham seu coração e de toda sua família!

Desejamos que este momento especial seja repleto de boas memórias, abraços calorosos e muita gratidão.

Boas Festas!
Com carinho,
Equipe`,
    category: "comemorativo",
    isCustom: false,
  },
  {
    id: "ano-novo-prospero",
    title: "Feliz Ano Novo - Próspero",
    message: `🎆 Feliz Ano Novo, {nome}! 🎆

Que 2025 seja um ano de muitas conquistas, saúde e prosperidade para você!

Que todos os seus sonhos se realizem e que cada dia traga novas oportunidades de crescimento e felicidade.

Um brinde ao novo ano! 🥂
Abraços,
Equipe`,
    category: "comemorativo",
    isCustom: false,
  },
  {
    id: "boas-festas-generica",
    title: "Boas Festas - Genérica",
    message: `✨ Olá, {nome}! ✨

Chegamos ao fim de mais um ano e queremos agradecer pela sua confiança e parceria!

Desejamos a você e sua família um final de ano repleto de momentos especiais, paz e muita felicidade.

Boas Festas e um próspero Ano Novo! 🎊
Com carinho,
Equipe`,
    category: "comemorativo",
    isCustom: false,
  },
];

export const getCustomTemplates = (): MessageTemplate[] => {
  try {
    const stored = localStorage.getItem("whatsapp-custom-templates");
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Erro ao carregar templates personalizados:", error);
    return [];
  }
};

export const getAllTemplates = (): MessageTemplate[] => {
  return [...getDefaultTemplates(), ...getCustomTemplates()];
};

export const saveCustomTemplate = (template: MessageTemplate): void => {
  try {
    const existing = getCustomTemplates();
    
    // Limite de 50 templates personalizados
    if (existing.length >= 50) {
      throw new Error("Limite de 50 templates personalizados atingido");
    }
    
    const updated = [...existing, template];
    localStorage.setItem("whatsapp-custom-templates", JSON.stringify(updated));
  } catch (error) {
    console.error("Erro ao salvar template:", error);
    throw error;
  }
};

export const updateCustomTemplate = (template: MessageTemplate): void => {
  try {
    const existing = getCustomTemplates();
    const index = existing.findIndex(t => t.id === template.id);
    
    if (index === -1) {
      throw new Error("Template não encontrado");
    }
    
    existing[index] = { ...template };
    localStorage.setItem("whatsapp-custom-templates", JSON.stringify(existing));
  } catch (error) {
    console.error("Erro ao atualizar template:", error);
    throw error;
  }
};

export const deleteCustomTemplate = (templateId: string): void => {
  try {
    const existing = getCustomTemplates();
    const filtered = existing.filter(t => t.id !== templateId);
    localStorage.setItem("whatsapp-custom-templates", JSON.stringify(filtered));
  } catch (error) {
    console.error("Erro ao excluir template:", error);
    throw error;
  }
};

export const getCategoryIcon = (category: MessageTemplate["category"]): string => {
  switch (category) {
    case "opt-in": return "✅";
    case "saudacao": return "👋";
    case "lembrete": return "📅";
    case "promocao": return "🎁";
    case "agradecimento": return "💚";
    case "aniversario": return "🎂";
    case "comemorativo": return "🎄";
    case "personalizado": return "✏️";
    default: return "📝";
  }
};

export const getCategoryLabel = (category: MessageTemplate["category"]): string => {
  switch (category) {
    case "opt-in": return "Opt-in";
    case "saudacao": return "Saudação";
    case "lembrete": return "Lembrete";
    case "promocao": return "Promoção";
    case "agradecimento": return "Agradecimento";
    case "aniversario": return "Aniversário";
    case "comemorativo": return "Comemorativo";
    case "personalizado": return "Personalizado";
    default: return "Outros";
  }
};
