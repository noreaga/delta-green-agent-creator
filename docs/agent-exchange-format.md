# DGAC Agent Exchange

DGAC Agent Exchange is the portable character format used by Delta Green Agent Creator. It is intentionally independent of Foundry document IDs so a future website, Foundry integration, Roll20 integration, or another approved client can exchange the same Agent data.

## Identification

JSON documents use:

```json
{
  "kind": "delta-green-agent",
  "schemaVersion": 1
}
```

Text codes begin with `DGAC1:` followed by Base64 encoded UTF 8 JSON containing the same document.

## Compatibility rules

Importers must validate `kind` and `schemaVersion` before reading Agent data. Unknown schema versions must be rejected instead of guessed. Implementations may add fields, but consumers must ignore fields they do not recognize.

## Portable data

The `agent` object contains creator level information such as statistics, profession, professional skills, specialties, background improvements, Damaged Veteran status, Bonds, biography, physical description, and Motivations.

The format does not contain Actor IDs, Item IDs, User IDs, World IDs, ownership permissions, Active Effects, or Foundry document metadata.

## Security

Importers must treat every document as untrusted input. Imported values must pass the same validation and Handler rules as manually entered values before being applied to an Actor.
