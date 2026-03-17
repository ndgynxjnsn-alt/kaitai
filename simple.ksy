meta:
  id: simple_packet
  endian: be
seq:
  - id: magic
    type: u2
  - id: length
    type: u2
  - id: payload
    size: length
  - id: checksum
    type: u1