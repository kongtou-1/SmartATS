export interface CandidateCommunication {
  id: string;
  channel: string;
  subject: string;
  body: string;
  delivery_status: string;
  created_at: string;
}

export default function CandidateCommunications({
  communications,
}: {
  communications: CandidateCommunication[];
}) {
  return (
    <section className="block">
      <h3>候选人消息记录</h3>
      {communications.length === 0 ? (
        <div className="muted">暂无出站通知</div>
      ) : (
        communications.map((item) => (
          <div className="message-card" key={item.id}>
            <b>{item.subject}</b>
            <p>{item.body}</p>
            <span className="muted">
              {item.channel} · {item.delivery_status} · {new Date(item.created_at).toLocaleString()}
            </span>
          </div>
        ))
      )}
    </section>
  );
}
