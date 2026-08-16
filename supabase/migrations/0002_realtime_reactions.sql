create policy "UNO members can send room reactions"
on realtime.messages for insert
to authenticated
with check (
  realtime.topic() like 'room:%'
  and public.is_uno_room_member(realtime.topic(), auth.uid())
);
