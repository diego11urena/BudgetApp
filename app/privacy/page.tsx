import type { Metadata } from "next";
import Link from "next/link";
import { getRequestLocale } from "@/lib/i18n/locale";

const CONTACT_EMAIL = "diego11urena@gmail.com";
const UPDATED = { en: "October 17, 2026", es: "17 de octubre de 2026" };

// Legal text lives here, not in the i18n dictionaries: it's one long
// page read as a whole, never reused piecemeal across the UI.
const CONTENT = {
  en: {
    title: "Privacy Policy",
    updated: "Last updated",
    back: "Back to Balboa",
    sections: [
      {
        h: "Who we are",
        p: [
          "Balboa is a personal budgeting app. This policy explains what information Balboa collects, how it's used, and the choices you have. Questions: " +
            CONTACT_EMAIL +
            ".",
        ],
      },
      {
        h: "What we collect",
        p: [
          "Your Google account basics: when you sign in with Google, we receive your name and email address. We use them to create and identify your account. We never see your Google password.",
          "What you enter: income, expenses, budgets, savings goals, categories and preferences (language, theme, pay schedule).",
          "Gmail transaction emails, only if you choose \"Connect Gmail\": see the next section.",
          "Cookies: a session cookie that keeps you signed in, plus cookies that remember your language and theme. No advertising or tracking cookies.",
        ],
      },
      {
        h: "Gmail access",
        p: [
          "Connecting Gmail is optional. If you connect it, Balboa requests read-only access and searches only for transaction notification emails from supported senders (currently Banco General and Yappy). It never reads, stores or sends any other email.",
          "From those notifications, Balboa saves only the transaction details: amount, merchant, date, payment method, any note the sender included, and the email's message ID (to avoid importing it twice). The email itself is not stored.",
          "To keep importing, Balboa stores an access token from Google, encrypted, along with the Gmail address you connected. Disconnecting Gmail on your Profile deletes it. You can also revoke access anytime at myaccount.google.com/permissions.",
          "Balboa's use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements. Gmail data is used only to show your own transactions to you. It is never sold, used for advertising, or read by humans, except with your permission, for security purposes, or when required by law.",
        ],
      },
      {
        h: "How we use your information",
        p: [
          "Only to run Balboa for you: showing your budget, calculating totals and insights, and keeping your account secure. We don't sell your data, share it with advertisers, or use it to train AI models.",
        ],
      },
      {
        h: "Where it's stored",
        p: [
          "Balboa runs on Vercel (hosting) and Neon (database), with Upstash used for rate limiting to prevent abuse. These providers process data on our behalf, and only to run the service. Data may be processed in the United States.",
        ],
      },
      {
        h: "Keeping and deleting your data",
        p: [
          "Your data is kept while your account exists. You can erase your budget history from Profile at any time. To delete your whole account and everything in it, email " +
            CONTACT_EMAIL +
            " from your account's address, and we'll delete it within 30 days.",
        ],
      },
      {
        h: "Changes",
        p: ["If this policy changes, we'll update the date above. Significant changes will be announced in the app."],
      },
    ],
  },
  es: {
    title: "Política de privacidad",
    updated: "Última actualización",
    back: "Volver a Balboa",
    sections: [
      {
        h: "Quiénes somos",
        p: [
          "Balboa es una app de presupuesto personal. Esta política explica qué información recopila Balboa, cómo se usa y qué opciones tienes. Preguntas: " +
            CONTACT_EMAIL +
            ".",
        ],
      },
      {
        h: "Qué recopilamos",
        p: [
          "Datos básicos de tu cuenta de Google: al iniciar sesión con Google recibimos tu nombre y correo electrónico. Los usamos para crear e identificar tu cuenta. Nunca vemos tu contraseña de Google.",
          "Lo que ingresas: ingresos, gastos, presupuestos, metas de ahorro, categorías y preferencias (idioma, tema, frecuencia de pago).",
          "Correos de transacciones de Gmail, solo si eliges \"Conectar Gmail\": ver la siguiente sección.",
          "Cookies: una cookie de sesión para mantenerte conectado y cookies que recuerdan tu idioma y tema. No usamos cookies de publicidad ni de rastreo.",
        ],
      },
      {
        h: "Acceso a Gmail",
        p: [
          "Conectar Gmail es opcional. Si lo conectas, Balboa solicita acceso de solo lectura y busca únicamente correos de notificación de transacciones de remitentes compatibles (actualmente Banco General y Yappy). Nunca lee, guarda ni envía ningún otro correo.",
          "De esas notificaciones, Balboa guarda solo los detalles de la transacción: monto, comercio, fecha, método de pago, la nota que haya incluido el remitente y el ID del mensaje (para no importarlo dos veces). El correo en sí no se guarda.",
          "Para seguir importando, Balboa guarda un token de acceso de Google, cifrado, junto con la dirección de Gmail que conectaste. Desconectar Gmail en tu Perfil lo elimina. También puedes revocar el acceso en cualquier momento en myaccount.google.com/permissions.",
          "El uso y la transferencia por parte de Balboa de la información recibida de las APIs de Google cumple con la Política de Datos de Usuario de los Servicios de API de Google, incluidos los requisitos de Uso Limitado. Los datos de Gmail se usan solo para mostrarte tus propias transacciones. Nunca se venden, no se usan para publicidad y ninguna persona los lee, salvo con tu permiso, por motivos de seguridad o cuando la ley lo exija.",
        ],
      },
      {
        h: "Cómo usamos tu información",
        p: [
          "Solo para que Balboa funcione para ti: mostrar tu presupuesto, calcular totales y resúmenes, y mantener tu cuenta segura. No vendemos tus datos, no los compartimos con anunciantes ni los usamos para entrenar modelos de IA.",
        ],
      },
      {
        h: "Dónde se guarda",
        p: [
          "Balboa funciona sobre Vercel (hosting) y Neon (base de datos), y usa Upstash para limitar solicitudes y prevenir abusos. Estos proveedores procesan datos en nuestro nombre y solo para operar el servicio. Los datos pueden procesarse en Estados Unidos.",
        ],
      },
      {
        h: "Conservación y eliminación",
        p: [
          "Tus datos se conservan mientras tu cuenta exista. Puedes borrar tu historial de presupuesto desde tu Perfil en cualquier momento. Para eliminar tu cuenta completa y todo su contenido, escribe a " +
            CONTACT_EMAIL +
            " desde el correo de tu cuenta y la eliminaremos en un plazo de 30 días.",
        ],
      },
      {
        h: "Cambios",
        p: ["Si esta política cambia, actualizaremos la fecha de arriba. Los cambios importantes se anunciarán en la app."],
      },
    ],
  },
};

export async function generateMetadata(): Promise<Metadata> {
  return { title: CONTENT[await getRequestLocale()].title };
}

export default async function PrivacyPage() {
  const locale = await getRequestLocale();
  const c = CONTENT[locale];
  return (
    <main className="legal-page">
      <Link href="/">{c.back}</Link>
      <h1>{c.title}</h1>
      <p className="field-hint">
        {c.updated}: {UPDATED[locale]}
      </p>
      {c.sections.map((s) => (
        <section key={s.h}>
          <h2>{s.h}</h2>
          {s.p.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>
      ))}
    </main>
  );
}
