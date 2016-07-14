require "sinatra"
require "pusher"

Pusher.url = "http://a1ef4d95b2ea5f33a5b9:8e283c6741e72d001ae4@api.pusherapp.com/apps/68249"

enable :sessions

helpers do
  def need_auth!
    unless session[:nick]
      # TODO: error 400 unless asking for html
      redirect to('/login')
    end
  end
end

get "/?" do
  need_auth!
  erb :index, locals: {nick: session[:nick], user_id: session[:user_id]}
end

get '/login' do
  erb :login
end

post "/login" do
  session[:user_id] = SecureRandom.hex
  session[:nick] = params[:nick]
  redirect to('/')
end

post "/logout" do
  session.clear
  redirect to('/login')
end

post "/presence" do
  data = JSON.load env['rack.input'].read
  require 'pp'
  pp data
  ''
end

post "/pusher/auth" do
  need_auth!
  content_type :json
  Pusher[params[:channel_name]].authenticate(
    params[:socket_id],
    user_id: session[:user_id],
    user_info: {
      nick: session[:nick],
    }
  ).to_json
end
