import { PageHero } from "../../../components/public/shell";
import { QuestionnaireForm } from "../../../components/questionnaire/form";

export default function QuestionnairePage() {
  return (
    <main>
      <PageHero
        className="questionnaire-hero"
        eyebrow="Анкета пациента"
        title="Первичный клинический разбор вашей ситуации"
        description={
          <>
            <span className="questionnaire-hero__line questionnaire-hero__line--primary">
              Спокойно и последовательно соберём клиническую картину, чтобы понять, что происходит и какой формат помощи будет для вас уместен
            </span>
            <span className="questionnaire-hero__line questionnaire-hero__line--meta">Анкета занимает 5–7 минут.</span>
          </>
        }
        supportingContent={
          <div className="questionnaire-page-intro stack-sm">
            <strong className="questionnaire-page-intro__title">Как это работает</strong>
            <div className="questionnaire-page-intro__grid">
              <div className="card questionnaire-page-intro-card stack-sm">
                <span className="questionnaire-page-intro-card__icon">01</span>
                <p>Вы заполняете анкету</p>
              </div>
              <div className="card questionnaire-page-intro-card stack-sm">
                <span className="questionnaire-page-intro-card__icon">02</span>
                <p>Врач лично изучает вашу ситуацию и материалы</p>
              </div>
              <div className="card questionnaire-page-intro-card stack-sm">
                <span className="questionnaire-page-intro-card__icon">03</span>
                <p>Определяет, подходит ли онлайн-формат</p>
              </div>
              <div className="card questionnaire-page-intro-card stack-sm">
                <span className="questionnaire-page-intro-card__icon">04</span>
                <p>Предлагает конкретный формат помощи и дальнейшие шаги</p>
              </div>
            </div>
          </div>
        }
      />

      <QuestionnaireForm />
    </main>
  );
}
