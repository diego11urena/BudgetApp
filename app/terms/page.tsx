import type { Metadata } from "next";
import { getRequestLocale } from "@/lib/i18n/locale";
import { LegalPage, CONTACT_EMAIL } from "@/app/_components/LegalPage";

const UPDATED = { en: "October 17, 2026", es: "17 de octubre de 2026" };

const CONTENT = {
  en: {
    title: "Terms of Use",
    sections: [
      {
        h: "Agreement",
        p: [
          "These Terms of Use govern your use of Balboa, a personal budgeting app. By ticking the box and signing in, you agree to these Terms and to our Privacy Policy. If you don't agree, don't use Balboa.",
        ],
      },
      {
        h: "Your account",
        p: [
          "You sign in with your Google account and must be at least 18 years old (or the age of majority where you live). You're responsible for activity on your account and for keeping your Google account secure.",
        ],
      },
      {
        h: "Not financial advice",
        p: [
          "Balboa is a tool to help you track your own money. Its totals, insights, projections and suggestions are informational only and are not financial, tax, legal or investment advice. Decisions you make based on them are your own.",
        ],
      },
      {
        h: "Accuracy of your data",
        p: [
          "Balboa shows whatever you enter or import. Transactions imported from Gmail are read automatically from bank notifications and may be missing, duplicated or wrong. Always check important figures against your bank. Balboa does not access your bank accounts and cannot move money.",
        ],
      },
      {
        h: "Acceptable use",
        p: [
          "Don't misuse Balboa: no attempting to access other people's data, disrupting the service, reverse-engineering it to attack it, or using it for anything illegal. We may suspend or close accounts that do.",
        ],
      },
      {
        h: "Ending your use",
        p: [
          "You can stop using Balboa and delete your account from Profile at any time. We may change, suspend or discontinue Balboa, or any part of it, at any time. If we shut it down, we'll try to give reasonable notice in the app.",
        ],
      },
      {
        h: "No warranty",
        p: [
          "Balboa is provided \"as is\" and \"as available\", without warranties of any kind, express or implied, including fitness for a particular purpose, accuracy, or uninterrupted, error-free or secure operation. Keep your own records of anything important.",
        ],
      },
      {
        h: "Limitation of liability",
        p: [
          "To the maximum extent permitted by law, Balboa and its owner will not be liable for any indirect, incidental, special, consequential or punitive damages, or for any loss of money, profits, data or goodwill, arising from your use of, or inability to use, Balboa.",
          "To the maximum extent permitted by law, our total liability for all claims relating to Balboa is limited to the greater of (a) the amount you paid us for Balboa in the 12 months before the claim, or (b) US$50.",
          "Some places don't allow these exclusions or limits, so they apply to you only as far as the law where you live allows.",
        ],
      },
      {
        h: "Changes to these Terms",
        p: [
          "We may update these Terms. We'll change the date above, and announce significant changes in the app. Continuing to use Balboa after a change means you accept the updated Terms.",
        ],
      },
      {
        h: "Governing law and contact",
        p: [
          "These Terms are governed by the laws of the Republic of Panama. Questions: " + CONTACT_EMAIL + ".",
        ],
      },
    ],
  },
  es: {
    title: "Términos de uso",
    sections: [
      {
        h: "Acuerdo",
        p: [
          "Estos Términos de uso rigen tu uso de Balboa, una app de presupuesto personal. Al marcar la casilla e iniciar sesión, aceptas estos Términos y nuestra Política de privacidad. Si no estás de acuerdo, no uses Balboa.",
        ],
      },
      {
        h: "Tu cuenta",
        p: [
          "Inicias sesión con tu cuenta de Google y debes tener al menos 18 años (o la mayoría de edad donde vives). Eres responsable de la actividad en tu cuenta y de mantener segura tu cuenta de Google.",
        ],
      },
      {
        h: "No es asesoría financiera",
        p: [
          "Balboa es una herramienta para ayudarte a llevar el control de tu propio dinero. Sus totales, resúmenes, proyecciones y sugerencias son solo informativos y no constituyen asesoría financiera, fiscal, legal ni de inversión. Las decisiones que tomes con base en ellos son tuyas.",
        ],
      },
      {
        h: "Exactitud de tus datos",
        p: [
          "Balboa muestra lo que ingresas o importas. Las transacciones importadas de Gmail se leen automáticamente de notificaciones bancarias y pueden faltar, duplicarse o estar equivocadas. Verifica siempre las cifras importantes con tu banco. Balboa no accede a tus cuentas bancarias y no puede mover dinero.",
        ],
      },
      {
        h: "Uso aceptable",
        p: [
          "No hagas mal uso de Balboa: no intentes acceder a datos de otras personas, interrumpir el servicio, hacerle ingeniería inversa para atacarlo ni usarlo para fines ilegales. Podemos suspender o cerrar las cuentas que lo hagan.",
        ],
      },
      {
        h: "Dejar de usar Balboa",
        p: [
          "Puedes dejar de usar Balboa y eliminar tu cuenta desde tu Perfil en cualquier momento. Podemos cambiar, suspender o discontinuar Balboa, o cualquier parte, en cualquier momento. Si lo cerramos, intentaremos avisar con anticipación razonable en la app.",
        ],
      },
      {
        h: "Sin garantía",
        p: [
          "Balboa se ofrece \"tal cual\" y \"según disponibilidad\", sin garantías de ningún tipo, expresas o implícitas, incluidas la idoneidad para un fin determinado, la exactitud o el funcionamiento ininterrumpido, libre de errores o seguro. Guarda tus propios registros de todo lo importante.",
        ],
      },
      {
        h: "Limitación de responsabilidad",
        p: [
          "En la máxima medida permitida por la ley, Balboa y su propietario no serán responsables de daños indirectos, incidentales, especiales, consecuentes o punitivos, ni de pérdidas de dinero, ganancias, datos o reputación, derivados del uso o la imposibilidad de usar Balboa.",
          "En la máxima medida permitida por la ley, nuestra responsabilidad total por todos los reclamos relacionados con Balboa se limita al mayor de: (a) el monto que nos pagaste por Balboa en los 12 meses anteriores al reclamo, o (b) US$50.",
          "Algunos lugares no permiten estas exclusiones o límites, por lo que se aplican a ti solo en la medida en que lo permita la ley de donde vives.",
        ],
      },
      {
        h: "Cambios a estos Términos",
        p: [
          "Podemos actualizar estos Términos. Cambiaremos la fecha de arriba y anunciaremos los cambios importantes en la app. Si sigues usando Balboa después de un cambio, aceptas los Términos actualizados.",
        ],
      },
      {
        h: "Ley aplicable y contacto",
        p: ["Estos Términos se rigen por las leyes de la República de Panamá. Preguntas: " + CONTACT_EMAIL + "."],
      },
    ],
  },
};

export async function generateMetadata(): Promise<Metadata> {
  return { title: CONTENT[await getRequestLocale()].title };
}

export default async function TermsPage() {
  const locale = await getRequestLocale();
  return <LegalPage {...CONTENT[locale]} updated={UPDATED[locale]} locale={locale} />;
}
