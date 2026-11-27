import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

// Pages légales publiques : /legal/mentions, /legal/confidentialite et /legal/cgu
const NOM = 'Sirac KOUGNAGLO'
const SIRET = '952 379 154 00018'
const ADRESSE = '2 allée Gauguin, 54000 Nancy, France'
const CONTACT = 'sirac.coaching@gmail.com'
const EDITEUR = `${NOM} (entrepreneur individuel, SIRET ${SIRET}, ${ADRESSE})`
const MAJ = '28 novembre 2026'

const DOCS = {
  mentions: {
    title: 'Mentions légales',
    sections: [
      ['Éditeur', `${NOM}
Entrepreneur individuel
SIRET : ${SIRET}
Adresse : ${ADRESSE}
Email : ${CONTACT}`],
      ['Directeur de la publication', NOM],
      ['Hébergement', `Application : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis (vercel.com).
Données : Supabase Inc., serveurs situés dans l’Union européenne (Francfort, Allemagne) (supabase.com).`],
      ['Propriété intellectuelle', `Le nom ARISE, l’application et les contenus du coach (programmes, vidéos, textes) sont protégés. Toute reproduction sans autorisation est interdite.`],
      ['Contact', `Pour toute question ou réclamation : ${CONTACT}.`],
    ],
  },
  confidentialite: {
    title: 'Politique de confidentialité',
    sections: [
      ['Qui sommes-nous ?', `ARISE est une application de coaching sportif éditée par ${EDITEUR} (le « coach »). Le coach est responsable du traitement de tes données. Contact : ${CONTACT}.`],
      ['Données collectées', `• Compte : nom, email, mot de passe (chiffré).
• Profil : date de naissance, sexe, taille, poids, niveau d’activité, objectifs, antécédents de blessure, sport.
• Suivi : séances réalisées, charges, ressentis, mensurations, photos de progression, bilans hebdomadaires, planning.
• Nutrition : journal alimentaire, allergies, régime, matériel de cuisine.
• Messagerie : messages, photos, vidéos et vocaux échangés avec ton coach.
• Technique : abonnement aux notifications de ton appareil.`],
      ['Données de santé', `Poids, mensurations, photos, allergies ou blessures sont des données de santé. Elles ne sont traitées qu’avec ton consentement explicite, donné à l’inscription, et uniquement pour ton suivi sportif et nutritionnel. Tu peux retirer ce consentement à tout moment en supprimant ton compte.`],
      ['Pourquoi ?', `Uniquement pour assurer ton coaching : créer tes programmes, suivre tes progrès, échanger avec ton coach, te proposer des plans alimentaires et t’envoyer des rappels. Aucune publicité, aucune revente de données.`],
      ['Qui y a accès ?', `Toi et ton coach uniquement. Les autres utilisateurs n’y ont jamais accès. Prestataires techniques (sous-traitants) :
• Supabase (base de données et fichiers, serveurs en Union européenne — Francfort) ;
• Vercel (hébergement de l’application) ;
• Anthropic (génération des plans alimentaires : objectif calorique, poids, sexe, objectif, allergies, régime et matériel sont transmis, sans nom ni email ; traitement aux États-Unis, encadré par les clauses contractuelles types de la Commission européenne) ;
• Open Food Facts (recherche d’aliments : seul le texte recherché ou le code-barre est envoyé) ;
• Apple / Google (acheminement des notifications).`],
      ['Combien de temps ?', `Tant que ton compte existe. À la suppression du compte, toutes tes données et photos sont effacées définitivement.`],
      ['Tes droits', `Tu peux à tout moment, depuis ton Profil : télécharger toutes tes données (« Mes données ») et supprimer ton compte. Tu peux aussi demander l’accès, la rectification, la limitation ou l’opposition en écrivant à ${CONTACT}. En cas de désaccord, tu peux saisir la CNIL (cnil.fr).`],
      ['Sécurité', `Connexions chiffrées (HTTPS), mots de passe chiffrés, accès cloisonné par utilisateur au niveau de la base de données, photos et pièces jointes stockées dans des espaces privés.`],
    ],
  },
  cgu: {
    title: 'Conditions d’utilisation',
    sections: [
      ['Objet', `ARISE permet à un coach sportif de suivre ses clients : programmes d’entraînement, planning, suivi des progrès, nutrition et messagerie. Éditeur : ${EDITEUR}. Contact : ${CONTACT}.`],
      ['Compte', `L’accès se fait sur invitation de ton coach. Tu es responsable de la confidentialité de ton mot de passe et des informations que tu renseignes.`],
      ['Santé et sécurité', `Les programmes et plans alimentaires ne remplacent pas un avis médical. Consulte un médecin avant de commencer une activité physique, en cas de douleur, de grossesse, de pathologie ou de traitement. Arrête l’exercice en cas de malaise.`],
      ['Plans alimentaires générés automatiquement', `Les plans alimentaires proposés automatiquement sont indicatifs. Ils tiennent compte des allergies déclarées, mais vérifie toujours les étiquettes des produits. En cas d’allergie sévère, demande l’avis d’un professionnel de santé.`],
      ['Bon usage', `Pas de contenu illégal, offensant ou portant atteinte aux droits d’autrui dans la messagerie. Les vidéos et photos envoyées doivent t’appartenir ou être utilisées avec l’accord des personnes filmées.`],
      ['Propriété', `Les programmes, vidéos et contenus du coach restent sa propriété : ils sont réservés à ton usage personnel.`],
      ['Disponibilité', `L’éditeur fait son possible pour que l’application fonctionne en continu, sans pouvoir le garantir (maintenance, panne d’un prestataire, réseau).`],
      ['Résiliation', `Tu peux supprimer ton compte à tout moment depuis ton Profil. Le coach peut mettre fin à l’accès en fin de suivi.`],
      ['Droit applicable', `Droit français. En cas de litige, une solution amiable sera recherchée avant toute action.`],
    ],
  },
}

export default function Legal() {
  const { doc } = useParams()
  const navigate = useNavigate()
  const d = DOCS[doc] || DOCS.confidentialite
  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)', color: 'var(--label)' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px', background: 'var(--bar-bg)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '0.5px solid var(--bar-border)' }}>
        <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} aria-label="Retour" style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', display: 'flex' }}><ChevronLeft size={28} /></button>
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>{d.title}</h1>
      </div>
      <div data-testid="legal" style={{ maxWidth: 680, margin: '0 auto', padding: '16px 18px 40px' }}>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--label2)' }}>ARISE · mise à jour le {MAJ}</p>
        {d.sections.map(([h, t]) => (
          <section key={h} className="ios-group" style={{ padding: '14px 16px', marginBottom: 10 }}>
            <h2 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>{h}</h2>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: 'var(--label1b)', whiteSpace: 'pre-line' }}>{t}</p>
          </section>
        ))}
        <p style={{ marginTop: 16, fontSize: 14, textAlign: 'center', display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          {Object.entries(DOCS).filter(([k]) => DOCS[doc] ? k !== doc : k !== 'confidentialite').map(([k, v]) => (
            <a key={k} href={`/legal/${k}`} style={{ color: 'var(--accent-text)' }}>{v.title}</a>
          ))}
        </p>
      </div>
    </div>
  )
}
