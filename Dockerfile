FROM debian:buster-slim

#--- Update & Install Base Packages ---
RUN apt update
RUN apt install -y curl \
    vim \
    iputils-ping \
    git-all \
    zsh \
    wget

#--- Setup Rust ---
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
# Use ENV instead of source, export and dot command.
ENV PATH="/root/.cargo/bin:${PATH}"
RUN ["/bin/bash", "-c", "source $HOME/.cargo/env"]
RUN rustup component add rustfmt

#--- Install Solana ---
RUN sh -c "$(curl -sSfL https://release.solana.com/v1.16.0/install)"
# Use ENV instead of source, export and dot command.
ENV PATH="/root/.local/share/solana/install/active_release/bin:${PATH}"

#--- Install Anchor ---
RUN cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
RUN avm install latest
RUN avm use latest

#--- Install Node ---
RUN npm install -g yarn

#--- Install React ---
RUN npm install -g create-react-app